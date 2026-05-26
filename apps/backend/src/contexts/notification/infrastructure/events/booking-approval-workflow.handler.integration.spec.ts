import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { createNotificationIntegrationApp } from '../../../../test/utils/notification-integration-app';
import { BookingEntity } from '../../../booking/infrastructure/entities/booking.entity';
import { BookingLineEntity } from '../../../booking/infrastructure/entities/booking-line.entity';
import { ServiceEntity } from '../../../booking/infrastructure/entities/service.entity';
import { ScheduleClosureEntity } from '../../../booking/infrastructure/entities/schedule-closure.entity';
import { ScheduleOpeningEntity } from '../../../booking/infrastructure/entities/schedule-opening.entity';
import { BookingModule } from '../../../booking/booking.module';
import { CustomerEntity } from '../../../customer/infrastructure/entities/customer.entity';
import { NotificationLogEntity } from '../entities/notification-log.entity';
import { StaffEntity } from '../../../staff/infrastructure/entities/staff.entity';
import { waitFor } from '../../../../test/utils/wait-for';
import { IEventBus } from '../../../../shared/ports/event-bus.port';
import { StaffInvitedHandler } from './staff-invited.handler';
import { BookingRequestedHandler } from './booking-requested.handler';
import { BookingApprovedEventBuilder } from '../../../../test/builders/booking/booking-approved-event.builder';
import { BookingRejectedEventBuilder } from '../../../../test/builders/booking/booking-rejected-event.builder';
import { BookingInfoRequestedEventBuilder } from '../../../../test/builders/booking/booking-info-requested-event.builder';
import { BookingInfoSubmittedEventBuilder } from '../../../../test/builders/booking/booking-info-submitted-event.builder';

const PLATFORM_KEY = 'approval-notif-test-key-xxxxxxxxxx';

// Suppress unrelated handlers to prevent cross-spec Pub/Sub interference.
const noOpHandler = { onModuleInit: () => undefined, handle: async () => undefined };

const BOOKING_ENTITIES = [
  BookingEntity,
  BookingLineEntity,
  ServiceEntity,
  ScheduleClosureEntity,
  ScheduleOpeningEntity,
  CustomerEntity,
] as const;

describe('Approval workflow notification handlers integration', () => {
  let app: INestApplication;
  let ds: DataSource;
  let dispatcher: InMemoryNotificationDispatcher;
  let eventBus: IEventBus;
  let tenantId: string;
  let managerEmail: string;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = PLATFORM_KEY;
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-appr-${Date.now()}`;
    process.env['JWT_SECRET'] = 'approval-notif-test-secret-32charsXX';

    dispatcher = new InMemoryNotificationDispatcher();
    ({ app, ds, eventBus } = await createNotificationIntegrationApp({
      dispatcher,
      configure: (b) =>
        b
          .overrideProvider(StaffInvitedHandler)
          .useValue(noOpHandler)
          .overrideProvider(BookingRequestedHandler)
          .useValue(noOpHandler),
      extraModules: [BookingModule],
      extraEntities: [...BOOKING_ENTITIES],
      withTenantInterceptor: true,
    }));

    managerEmail = `appr-manager-${Date.now()}@lavacar.com.br`;
    const slug = `appr-${Date.now()}`;

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({
        name: 'Approval Test',
        slug,
        adminEmail: managerEmail,
        timezone: 'America/Sao_Paulo',
      })
      .expect(201);

    tenantId = body.tenantId as string;

    await waitFor(async () => {
      const staff = await ds
        .getRepository(StaffEntity)
        .findOne({ where: { tenantId, role: 'MANAGER' } });
      return staff !== null;
    });
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PLATFORM_ADMIN_KEY'];
    delete process.env['PUBSUB_SUBSCRIPTION_SUFFIX'];
    delete process.env['JWT_SECRET'];
  });

  afterEach(() => {
    dispatcher.clear();
  });

  it('BookingApproved → customer confirmation email dispatched and log written', async () => {
    const guestEmail = `approved-${Date.now()}@example.com`;
    const event = new BookingApprovedEventBuilder()
      .withTenantId(tenantId)
      .withGuestEmail(guestEmail)
      .build();

    await eventBus.publish(event);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, eventId: event.eventId, notificationType: 'BOOKING_APPROVED_CUSTOMER' },
      });
      return log !== null;
    });

    const msg = dispatcher.dispatched.find((m) => m.templateKey === 'booking-approved-customer');
    expect(msg).toBeDefined();
    expect(msg!.to).toBe(guestEmail);
    expect(msg!.subject).toBe('Seu agendamento foi confirmado! ✓');
  });

  it('BookingRejected → customer rejection email dispatched and log written', async () => {
    const guestEmail = `rejected-${Date.now()}@example.com`;
    const event = new BookingRejectedEventBuilder()
      .withTenantId(tenantId)
      .withGuestEmail(guestEmail)
      .build();

    await eventBus.publish(event);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, eventId: event.eventId, notificationType: 'BOOKING_REJECTED_CUSTOMER' },
      });
      return log !== null;
    });

    const msg = dispatcher.dispatched.find((m) => m.templateKey === 'booking-rejected-customer');
    expect(msg).toBeDefined();
    expect(msg!.to).toBe(guestEmail);
    expect(msg!.subject).toBe('Sobre seu pedido de agendamento');
  });

  it('BookingInfoRequested (guest) → email with tokenised respond-link dispatched', async () => {
    const bookingId = uuidv7();
    const guestEmail = `info-req-${Date.now()}@example.com`;
    const event = new BookingInfoRequestedEventBuilder()
      .withTenantId(tenantId)
      .withBookingId(bookingId)
      .withGuestEmail(guestEmail)
      .withCustomerId(null)
      .build();

    await eventBus.publish(event);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: {
          tenantId,
          eventId: event.eventId,
          notificationType: 'BOOKING_INFO_REQUESTED_CUSTOMER',
        },
      });
      return log !== null;
    });

    const msg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-info-requested-customer',
    );
    expect(msg).toBeDefined();
    expect(msg!.to).toBe(guestEmail);
    expect(msg!.subject).toBe('Precisamos de mais informações sobre seu agendamento');
    expect(msg!.data['respondLink']).toContain(`/bookings/${bookingId}/responder?token=`);
  });

  it('BookingInfoRequested (authenticated) → email with dashboard link dispatched', async () => {
    const bookingId = uuidv7();
    const customerId = uuidv7();
    const guestEmail = `auth-req-${Date.now()}@example.com`;
    const event = new BookingInfoRequestedEventBuilder()
      .withTenantId(tenantId)
      .withBookingId(bookingId)
      .withGuestEmail(guestEmail)
      .withCustomerId(customerId)
      .build();

    await eventBus.publish(event);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: {
          tenantId,
          eventId: event.eventId,
          notificationType: 'BOOKING_INFO_REQUESTED_CUSTOMER',
        },
      });
      return log !== null;
    });

    const msg = dispatcher.dispatched.find((m) => m.to === guestEmail);
    expect(msg).toBeDefined();
    expect(msg!.data['respondLink']).toContain(`/dashboard/bookings/${bookingId}`);
    expect(String(msg!.data['respondLink'])).not.toContain('token=');
  });

  it('BookingInfoSubmitted → manager email dispatched and log written', async () => {
    const submittedByEmail = `customer-${Date.now()}@example.com`;
    const event = new BookingInfoSubmittedEventBuilder()
      .withTenantId(tenantId)
      .withSubmittedByEmail(submittedByEmail)
      .build();

    await eventBus.publish(event);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: {
          tenantId,
          eventId: event.eventId,
          notificationType: 'BOOKING_INFO_SUBMITTED_ADMIN',
        },
      });
      return log !== null;
    });

    const msg = dispatcher.dispatched.find((m) => m.templateKey === 'booking-info-submitted-admin');
    expect(msg).toBeDefined();
    expect(msg!.to).toBe(managerEmail);
    expect(msg!.subject).toBe('Cliente respondeu à solicitação de informações');
  });

  it('is idempotent: re-delivery of BookingApproved dispatches email only once', async () => {
    const guestEmail = `idem-${Date.now()}@example.com`;
    const event = new BookingApprovedEventBuilder()
      .withTenantId(tenantId)
      .withGuestEmail(guestEmail)
      .build();

    await eventBus.publish(event);
    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, eventId: event.eventId, notificationType: 'BOOKING_APPROVED_CUSTOMER' },
      });
      return log !== null;
    });

    const countBefore = dispatcher.dispatched.filter(
      (m) => m.templateKey === 'booking-approved-customer' && m.to === guestEmail,
    ).length;

    await eventBus.publish(event);

    const redeliveryDeadline = Date.now() + 2000;
    await waitFor(async () => {
      const newCount = dispatcher.dispatched.filter(
        (m) => m.templateKey === 'booking-approved-customer' && m.to === guestEmail,
      ).length;
      if (newCount > countBefore) {
        throw new Error('Idempotency broken: email dispatched again on re-delivery');
      }
      return Date.now() >= redeliveryDeadline;
    });

    const logs = await ds.getRepository(NotificationLogEntity).find({
      where: { tenantId, eventId: event.eventId },
    });
    expect(logs).toHaveLength(1);
  });
});
