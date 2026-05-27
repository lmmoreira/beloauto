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

const PLATFORM_KEY = 'full-workflow-notif-key-xxxxxxxxxx';

const BOOKING_ENTITIES = [
  BookingEntity,
  BookingLineEntity,
  ServiceEntity,
  ScheduleClosureEntity,
  ScheduleOpeningEntity,
  CustomerEntity,
] as const;

describe('Story: full booking lifecycle → Pub/Sub → all notification emails dispatched (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let dispatcher: InMemoryNotificationDispatcher;
  let tenantId: string;
  let adminEmail: string;
  let staffId: string;
  let customerId: string;
  let customerEmail: string;
  let serviceId: string;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = PLATFORM_KEY;
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-bfw-${Date.now()}`;
    process.env['JWT_SECRET'] = 'booking-full-workflow-notif-test-secret-32c';

    dispatcher = new InMemoryNotificationDispatcher();
    // All handlers active — no noOp suppression needed since there is only one spec.
    ({ app, ds } = await createNotificationIntegrationApp({
      dispatcher,
      extraModules: [BookingModule],
      extraEntities: [...BOOKING_ENTITIES],
      withTenantInterceptor: true,
    }));

    const slug = `bfw-${Date.now()}`;
    adminEmail = `admin-bfw-${Date.now()}@lavacar.com.br`;

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({ name: 'Full Workflow Notif', slug, adminEmail, timezone: 'America/Sao_Paulo' })
      .expect(201);

    tenantId = body.tenantId as string;

    // Wait for both manager record AND STAFF_INVITED notification so the provisioning
    // noise is fully drained before the it() block starts accumulating messages.
    await waitFor(async () => {
      const staff = await ds
        .getRepository(StaffEntity)
        .findOne({ where: { tenantId, role: 'MANAGER' } });
      if (!staff) return false;
      const log = await ds
        .getRepository(NotificationLogEntity)
        .findOne({ where: { tenantId, notificationType: 'STAFF_INVITED' } });
      return log !== null;
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
    customerEmail = `customer-bfw-${Date.now()}@example.com`;
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

  it('full booking lifecycle: STAFF_INVITED + all 6 booking notification types dispatched', async () => {
    // 1. Authenticated customer creates booking
    const { body: b1 } = await request(app.getHttpServer())
      .post('/bookings/authenticated')
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', customerId)
      .set('X-Actor-Type', 'CUSTOMER')
      .set('X-Actor-Role', 'CUSTOMER')
      .send({ scheduledAt: '2026-07-01T10:00:00.000Z', serviceIds: [serviceId] })
      .expect(201);

    const booking1Id = b1.bookingId as string;

    // 2. Staff requests more info (booking1: PENDING → INFO_REQUESTED)
    await request(app.getHttpServer())
      .patch(`/bookings/${booking1Id}/request-info`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', staffId)
      .set('X-Actor-Type', 'STAFF')
      .set('X-Actor-Role', 'MANAGER')
      .send({ message: 'Please provide clear photos of the vehicle damage area' })
      .expect(200);

    // 3. Customer submits info (booking1: INFO_REQUESTED → PENDING)
    await request(app.getHttpServer())
      .patch(`/bookings/${booking1Id}/submit-info`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', customerId)
      .set('X-Actor-Type', 'CUSTOMER')
      .set('X-Actor-Role', 'CUSTOMER')
      .send({ response: 'Here are the photos you requested' })
      .expect(200);

    // 4. Staff approves (booking1: PENDING → APPROVED)
    await request(app.getHttpServer())
      .patch(`/bookings/${booking1Id}/approve`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', staffId)
      .set('X-Actor-Type', 'STAFF')
      .set('X-Actor-Role', 'MANAGER')
      .expect(200);

    // 5. Guest creates a second booking (for rejection flow)
    const guestEmail = `guest-bfw-${Date.now()}@example.com`;
    const { body: b2 } = await request(app.getHttpServer())
      .post('/bookings')
      .set('X-Tenant-ID', tenantId)
      .send({
        guestEmail,
        guestName: 'Ana Costa',
        guestPhone: '31998765432',
        scheduledAt: '2026-07-02T14:00:00.000Z',
        serviceIds: [serviceId],
      })
      .expect(201);

    const booking2Id = b2.bookingId as string;

    // 6. Staff rejects guest booking (booking2: PENDING → REJECTED)
    await request(app.getHttpServer())
      .patch(`/bookings/${booking2Id}/reject`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Actor-ID', staffId)
      .set('X-Actor-Type', 'STAFF')
      .set('X-Actor-Role', 'MANAGER')
      .send({ reason: 'Selected slot is no longer available at that date' })
      .expect(200);

    // Wait for all 9 notification logs:
    //   1x STAFF_INVITED
    //   2x BOOKING_REQUESTED_* (booking1) + 2x BOOKING_REQUESTED_* (booking2)
    //   1x BOOKING_INFO_REQUESTED_CUSTOMER
    //   1x BOOKING_INFO_SUBMITTED_ADMIN
    //   1x BOOKING_APPROVED_CUSTOMER
    //   1x BOOKING_REJECTED_CUSTOMER
    await waitFor(async () => {
      const logs = await ds.getRepository(NotificationLogEntity).find({ where: { tenantId } });
      return logs.length >= 9;
    });

    // Assert all 7 notification types are present in the DB
    const logs = await ds.getRepository(NotificationLogEntity).find({ where: { tenantId } });
    const logTypes = logs.map((l) => l.notificationType);
    expect(logTypes).toContain('STAFF_INVITED');
    expect(logTypes).toContain('BOOKING_REQUESTED_ADMIN');
    expect(logTypes).toContain('BOOKING_REQUESTED_CUSTOMER');
    expect(logTypes).toContain('BOOKING_INFO_REQUESTED_CUSTOMER');
    expect(logTypes).toContain('BOOKING_INFO_SUBMITTED_ADMIN');
    expect(logTypes).toContain('BOOKING_APPROVED_CUSTOMER');
    expect(logTypes).toContain('BOOKING_REJECTED_CUSTOMER');

    // Assert each templateKey was dispatched to the right recipient
    const staffMsg = dispatcher.dispatched.find((m) => m.templateKey === 'staff-invitation');
    expect(staffMsg).toBeDefined();
    expect(staffMsg!.to).toBe(adminEmail);

    const requestedAdminMsgs = dispatcher.dispatched.filter(
      (m) => m.templateKey === 'booking-requested-admin',
    );
    expect(requestedAdminMsgs).toHaveLength(2);
    expect(requestedAdminMsgs.every((m) => m.to === adminEmail)).toBe(true);

    const requestedCustomerMsgs = dispatcher.dispatched.filter(
      (m) => m.templateKey === 'booking-requested-customer',
    );
    expect(requestedCustomerMsgs).toHaveLength(2);

    const infoReqMsg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-info-requested-customer',
    );
    expect(infoReqMsg).toBeDefined();
    expect(infoReqMsg!.to).toBe(customerEmail);

    const infoSubmitMsg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-info-submitted-admin',
    );
    expect(infoSubmitMsg).toBeDefined();
    expect(infoSubmitMsg!.to).toBe(adminEmail);

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
