import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { createNotificationIntegrationApp } from '../../../../test/utils/notification-integration-app';
import { ServiceEntityBuilder } from '../../../../test/builders/booking/service-entity.builder';
import { CustomerEntityBuilder } from '../../../../test/builders/customer/customer-entity.builder';
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
import { StaffInvitedHandler } from './staff-invited.handler';
import { BookingRequestedHandler } from './booking-requested.handler';

const PLATFORM_KEY = 'booking-workflow-notif-key-xxxxxxxx';

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

describe('Story: booking workflow → Pub/Sub → approval notification emails dispatched (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let dispatcher: InMemoryNotificationDispatcher;
  let tenantId: string;
  let staffId: string;
  let customerId: string;
  let customerEmail: string;
  let serviceId: string;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = PLATFORM_KEY;
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-bkw-${Date.now()}`;
    process.env['JWT_SECRET'] = 'booking-workflow-notif-test-secret-32c';

    dispatcher = new InMemoryNotificationDispatcher();
    ({ app, ds } = await createNotificationIntegrationApp({
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

    const slug = `bkw-${Date.now()}`;
    const adminEmail = `admin-bkw-${Date.now()}@lavacar.com.br`;

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({ name: 'Booking Workflow Notif', slug, adminEmail, timezone: 'America/Sao_Paulo' })
      .expect(201);

    tenantId = body.tenantId as string;

    await waitFor(async () => {
      const staff = await ds
        .getRepository(StaffEntity)
        .findOne({ where: { tenantId, role: 'MANAGER' } });
      return staff !== null;
    });

    const manager = await ds
      .getRepository(StaffEntity)
      .findOne({ where: { tenantId, role: 'MANAGER' } });
    staffId = manager!.id;

    const service = new ServiceEntityBuilder()
      .withTenantId(tenantId)
      .withName('Lavagem Premium')
      .withDurationMinutes(60)
      .build();
    await ds.getRepository(ServiceEntity).save(service);
    serviceId = service.id;

    customerId = uuidv7();
    customerEmail = `customer-bkw-${Date.now()}@example.com`;
    await ds
      .getRepository(CustomerEntity)
      .save(
        new CustomerEntityBuilder()
          .withId(customerId)
          .withTenantId(tenantId)
          .withEmail(customerEmail)
          .withPhone('31999888777')
          .build(),
      );
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

  it('full booking workflow: info-requested → info-submitted → approved → rejected notifications dispatched', async () => {
    // 1. Authenticated customer creates booking
    const { body: booking1Body } = await request(app.getHttpServer())
      .post('/bookings/authenticated')
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', customerId)
      .set('X-Actor-Type', 'CUSTOMER')
      .set('X-Actor-Role', 'CUSTOMER')
      .send({ scheduledAt: '2026-07-01T10:00:00.000Z', serviceIds: [serviceId] })
      .expect(201);

    const booking1Id = booking1Body.bookingId as string;

    // 2. Staff requests more info → BOOKING_INFO_REQUESTED_CUSTOMER email
    await request(app.getHttpServer())
      .patch(`/bookings/${booking1Id}/request-info`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', staffId)
      .set('X-Actor-Type', 'STAFF')
      .set('X-Actor-Role', 'MANAGER')
      .send({ message: 'Please provide clear photos of the vehicle damage area' })
      .expect(200);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'BOOKING_INFO_REQUESTED_CUSTOMER' },
      });
      return log !== null;
    });

    // 3. Customer submits info → BOOKING_INFO_SUBMITTED_ADMIN email
    await request(app.getHttpServer())
      .patch(`/bookings/${booking1Id}/submit-info`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', customerId)
      .set('X-Actor-Type', 'CUSTOMER')
      .set('X-Actor-Role', 'CUSTOMER')
      .send({ response: 'Here are the photos you requested' })
      .expect(200);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'BOOKING_INFO_SUBMITTED_ADMIN' },
      });
      return log !== null;
    });

    // 4. Staff approves → BOOKING_APPROVED_CUSTOMER email
    await request(app.getHttpServer())
      .patch(`/bookings/${booking1Id}/approve`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', staffId)
      .set('X-Actor-Type', 'STAFF')
      .set('X-Actor-Role', 'MANAGER')
      .expect(200);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'BOOKING_APPROVED_CUSTOMER' },
      });
      return log !== null;
    });

    // 5. Guest creates a second booking (for rejection flow)
    const guestEmail = `guest-rej-${Date.now()}@example.com`;
    const { body: booking2Body } = await request(app.getHttpServer())
      .post('/bookings')
      .set('X-Tenant-ID', tenantId)
      .send({
        guestEmail,
        guestName: 'Pedro Gomes',
        guestPhone: '31999777666',
        scheduledAt: '2026-07-02T14:00:00.000Z',
        serviceIds: [serviceId],
      })
      .expect(201);

    const booking2Id = booking2Body.bookingId as string;

    // 6. Staff rejects the guest booking → BOOKING_REJECTED_CUSTOMER email
    await request(app.getHttpServer())
      .patch(`/bookings/${booking2Id}/reject`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', staffId)
      .set('X-Actor-Type', 'STAFF')
      .set('X-Actor-Role', 'MANAGER')
      .send({ reason: 'Selected slot is no longer available at that date' })
      .expect(200);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'BOOKING_REJECTED_CUSTOMER' },
      });
      return log !== null;
    });

    // Assert all 4 workflow notification types were logged and dispatched
    const logs = await ds.getRepository(NotificationLogEntity).find({ where: { tenantId } });
    const logTypes = new Set(logs.map((l) => l.notificationType));
    expect(logTypes.has('BOOKING_INFO_REQUESTED_CUSTOMER')).toBe(true);
    expect(logTypes.has('BOOKING_INFO_SUBMITTED_ADMIN')).toBe(true);
    expect(logTypes.has('BOOKING_APPROVED_CUSTOMER')).toBe(true);
    expect(logTypes.has('BOOKING_REJECTED_CUSTOMER')).toBe(true);

    const infoReqMsg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-info-requested-customer',
    );
    expect(infoReqMsg).toBeDefined();
    expect(infoReqMsg!.to).toBe(customerEmail);

    const infoSubmitMsg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-info-submitted-admin',
    );
    expect(infoSubmitMsg).toBeDefined();

    const approvedMsg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-approved-customer',
    );
    expect(approvedMsg).toBeDefined();
    expect(approvedMsg!.to).toBe(customerEmail);

    const rejectedMsg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-rejected-customer',
    );
    expect(rejectedMsg).toBeDefined();
    expect(rejectedMsg!.to).toBe(guestEmail);
  });
});
