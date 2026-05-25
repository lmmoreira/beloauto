import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { EventBusModule } from '../../../../shared/infrastructure/event-bus.module';
import { TransactionManagerModule } from '../../../../shared/infrastructure/transaction-manager.module';
import { HotsiteConfigEntity } from '../../../platform/infrastructure/entities/hotsite-config.entity';
import { TenantEntity } from '../../../platform/infrastructure/entities/tenant.entity';
import { PlatformModule } from '../../../platform/platform.module';
import { StaffEntity } from '../../../staff/infrastructure/entities/staff.entity';
import { StaffModule } from '../../../staff/staff.module';
import { NOTIFICATION_DISPATCHER } from '../../application/ports/notification-dispatcher.port';
import { NotificationLogEntity } from '../entities/notification-log.entity';
import { NotificationModule } from '../../notification.module';
import { waitFor } from '../../../../test/utils/wait-for';
import { BookingRequested } from '../../../booking/domain/events/booking-requested.event';
import { EVENT_BUS, IEventBus } from '../../../../shared/ports/event-bus.port';

const PLATFORM_KEY = 'booking-notif-test-key-xxxxxxxxx';

describe('BookingRequestedHandler integration', () => {
  let app: INestApplication;
  let ds: DataSource;
  let dispatcher: InMemoryNotificationDispatcher;
  let eventBus: IEventBus;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = PLATFORM_KEY;
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-bkr-${Date.now()}`;
    dispatcher = new InMemoryNotificationDispatcher();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [TenantEntity, HotsiteConfigEntity, StaffEntity, NotificationLogEntity],
          synchronize: false,
        }),
        EventBusModule,
        TransactionManagerModule,
        PlatformModule,
        StaffModule,
        NotificationModule,
      ],
    })
      .overrideProvider(NOTIFICATION_DISPATCHER)
      .useValue(dispatcher)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    ds = moduleRef.get(DataSource);
    eventBus = moduleRef.get(EVENT_BUS);
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PLATFORM_ADMIN_KEY'];
    delete process.env['PUBSUB_SUBSCRIPTION_SUFFIX'];
  });

  afterEach(() => {
    dispatcher.clear();
  });

  it('BookingRequested → admin + customer emails dispatched + two log rows written', async () => {
    const slug = `booking-notif-${Date.now()}`;
    const adminEmail = `admin-${Date.now()}@lavacar.com.br`;

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({ name: 'Lava Car Test', slug, adminEmail, timezone: 'America/Sao_Paulo' })
      .expect(201);

    const tenantId: string = body.tenantId;

    // Wait for manager staff to exist in DB (TenantProvisioned → StaffInvited flow completes)
    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'STAFF_INVITED', channel: 'EMAIL' },
      });
      return log !== null;
    });

    dispatcher.clear();

    const guestEmail = `guest-${Date.now()}@example.com`;
    const event = new BookingRequested(tenantId, 'corr-booking-1', {
      bookingId: 'bbbbbbbb-1111-4000-8000-000000000001',
      type: 'GUEST',
      customerId: null,
      guestEmail,
      guestName: 'João Silva',
      guestPhone: '+5531999999999',
      guestAddress: null,
      scheduledAt: '2026-06-15T13:00:00.000Z',
      totalDurationMins: 60,
      totalPrice: { amount: '150.00', currency: 'BRL' },
      requiresPickup: false,
      pickupAddress: null,
      lines: [
        {
          lineId: 'cccccccc-1111-4000-8000-000000000001',
          serviceId: 'dddddddd-1111-4000-8000-000000000001',
          serviceNameAtBooking: 'Lavagem Completa',
          priceAtBooking: { amount: '150.00', currency: 'BRL' },
          durationMinsAtBooking: 60,
          pointsValueAtBooking: 1,
          requiresPickupAddressAtBooking: false,
        },
      ],
      beforeServicePhotoUrls: [],
    });

    await eventBus.publish(event);

    await waitFor(async () => {
      const logs = await ds.getRepository(NotificationLogEntity).find({
        where: { tenantId, eventId: event.eventId },
      });
      return logs.length >= 2;
    });

    const logs = await ds
      .getRepository(NotificationLogEntity)
      .find({ where: { tenantId, eventId: event.eventId } });

    expect(logs).toHaveLength(2);
    const types = logs.map((l) => l.notificationType);
    expect(types).toContain('BOOKING_REQUESTED_ADMIN');
    expect(types).toContain('BOOKING_REQUESTED_CUSTOMER');

    const adminMsg = dispatcher.dispatched.find((m) => m.templateKey === 'booking-requested-admin');
    expect(adminMsg).toBeDefined();
    expect(adminMsg!.to).toBe(adminEmail);
    expect(adminMsg!.subject).toContain('Nova solicitação de agendamento');
    expect(adminMsg!.subject).toContain('Lavagem Completa');

    const customerMsg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-requested-customer',
    );
    expect(customerMsg).toBeDefined();
    expect(customerMsg!.to).toBe(guestEmail);
    expect(customerMsg!.subject).toBe('Seu agendamento foi recebido');
  });

  it('is idempotent: re-delivery of same eventId produces exactly 2 log rows total', async () => {
    const slug = `booking-idem-${Date.now()}`;
    const adminEmail = `admin-idem-${Date.now()}@lavacar.com.br`;

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({ name: 'Idem Test', slug, adminEmail, timezone: 'America/Sao_Paulo' })
      .expect(201);

    const tenantId: string = body.tenantId;

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'STAFF_INVITED', channel: 'EMAIL' },
      });
      return log !== null;
    });

    dispatcher.clear();

    const event = new BookingRequested(tenantId, 'corr-idem-1', {
      bookingId: 'bbbbbbbb-2222-4000-8000-000000000001',
      type: 'GUEST',
      customerId: null,
      guestEmail: `idem-guest-${Date.now()}@example.com`,
      guestName: 'Maria',
      guestPhone: '+5531999999999',
      guestAddress: null,
      scheduledAt: '2026-07-01T13:00:00.000Z',
      totalDurationMins: 30,
      totalPrice: { amount: '80.00', currency: 'BRL' },
      requiresPickup: false,
      pickupAddress: null,
      lines: [
        {
          lineId: 'cccccccc-2222-4000-8000-000000000001',
          serviceId: 'dddddddd-2222-4000-8000-000000000001',
          serviceNameAtBooking: 'Lavagem Simples',
          priceAtBooking: { amount: '80.00', currency: 'BRL' },
          durationMinsAtBooking: 30,
          pointsValueAtBooking: 0,
          requiresPickupAddressAtBooking: false,
        },
      ],
      beforeServicePhotoUrls: [],
    });

    await eventBus.publish(event);
    await waitFor(async () => {
      const logs = await ds
        .getRepository(NotificationLogEntity)
        .find({ where: { tenantId, eventId: event.eventId } });
      return logs.length >= 2;
    });

    // Publish the same event again (re-delivery simulation)
    await eventBus.publish(event);

    // Allow time for the second delivery to be processed before asserting
    const afterRedeliver = Date.now() + 600;
    await waitFor(async () => Date.now() >= afterRedeliver);

    const logs = await ds
      .getRepository(NotificationLogEntity)
      .find({ where: { tenantId, eventId: event.eventId } });

    expect(logs).toHaveLength(2);
  });
});
