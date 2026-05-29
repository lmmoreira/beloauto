import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { IEventBus } from '../../../../shared/ports/event-bus.port';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { createNotificationIntegrationApp } from '../../../../test/utils/notification-integration-app';
import { CustomerEntityBuilder } from '../../../../test/builders/customer/index';
import { ServiceEntityBuilder } from '../../../../test/builders/booking/index';
import { CustomerEntity } from '../../../customer/infrastructure/entities/customer.entity';
import { ServiceEntity } from '../../../booking/infrastructure/entities/service.entity';
import { NotificationLogEntity } from '../entities/notification-log.entity';
import { ServicePointsEarned } from '../../../loyalty/domain/events/service-points-earned.event';
import { waitFor } from '../../../../test/utils/wait-for';

const PLATFORM_KEY = 'spe-notif-integ-key-xxxxxxxxxxxxx';

describe('ServicePointsEarnedHandler (integration)', () => {
  let app: INestApplication;
  let dispatcher: InMemoryNotificationDispatcher;
  let ds: DataSource;
  let eventBus: IEventBus;
  let tenantId: string;
  let customerId: string;
  let serviceId1: string;
  let serviceId2: string;
  let customerEmail: string;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = PLATFORM_KEY;
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-spe-${Date.now()}`;

    dispatcher = new InMemoryNotificationDispatcher();

    ({ app, ds, eventBus } = await createNotificationIntegrationApp({
      dispatcher,
      extraEntities: [CustomerEntity, ServiceEntity],
    }));

    const slug = `spe-${Date.now()}`;
    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({ name: 'SPE Test Tenant', slug, adminEmail: `admin-${slug}@example.com` })
      .expect(201);
    tenantId = body.tenantId as string;

    await waitFor(async () => {
      const log = await ds
        .getRepository(NotificationLogEntity)
        .findOne({ where: { tenantId, notificationType: 'STAFF_INVITED' } });
      return log !== null;
    });

    customerId = uuidv7();
    customerEmail = `spe-customer-${Date.now()}@example.com`;
    serviceId1 = uuidv7();
    serviceId2 = uuidv7();

    await ds
      .getRepository(CustomerEntity)
      .save(
        new CustomerEntityBuilder()
          .withId(customerId)
          .withTenantId(tenantId)
          .withEmail(customerEmail)
          .withName('Maria Silva')
          .build(),
      );

    await ds
      .getRepository(ServiceEntity)
      .save([
        new ServiceEntityBuilder()
          .withId(serviceId1)
          .withTenantId(tenantId)
          .withName('Lavagem Premium')
          .build(),
        new ServiceEntityBuilder()
          .withId(serviceId2)
          .withTenantId(tenantId)
          .withName('Enceramento')
          .build(),
      ]);
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PLATFORM_ADMIN_KEY'];
    delete process.env['PUBSUB_SUBSCRIPTION_SUFFIX'];
  });

  it('dispatches ONE thank-you email per booking with all services listed', async () => {
    const event = new ServicePointsEarned(tenantId, uuidv7(), {
      customerId,
      bookingId: uuidv7(),
      totalPointsEarned: 15,
      earnedAt: new Date().toISOString(),
      lines: [
        {
          entryId: uuidv7(),
          serviceId: serviceId1,
          pointsEarned: 10,
          expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          entryId: uuidv7(),
          serviceId: serviceId2,
          pointsEarned: 5,
          expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      currentBalance: 15,
    });

    await eventBus.publish(event);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, eventId: event.eventId, notificationType: 'SERVICE_POINTS_EARNED' },
      });
      return log !== null;
    });

    const msgs = dispatcher.dispatched.filter(
      (m) => m.templateKey === 'service-points-earned' && m.to === customerEmail,
    );
    expect(msgs).toHaveLength(1);

    const msg = msgs[0];
    expect(msg.subject).toContain('15 pontos');
    expect(msg.data['totalPointsEarned']).toBe(15);
    expect(msg.data['currentBalance']).toBe(15);

    const services = msg.data['services'] as Array<{ serviceName: string }>;
    expect(services).toHaveLength(2);
    expect(services.map((s) => s.serviceName)).toContain('Lavagem Premium');
    expect(services.map((s) => s.serviceName)).toContain('Enceramento');
  });

  it('is idempotent — replaying same event produces only one notification log', async () => {
    const event = new ServicePointsEarned(tenantId, uuidv7(), {
      customerId,
      bookingId: uuidv7(),
      totalPointsEarned: 5,
      earnedAt: new Date().toISOString(),
      lines: [
        {
          entryId: uuidv7(),
          serviceId: serviceId1,
          pointsEarned: 5,
          expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      currentBalance: 20,
    });

    await eventBus.publish(event);
    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, eventId: event.eventId, notificationType: 'SERVICE_POINTS_EARNED' },
      });
      return log !== null;
    });

    await eventBus.publish(event);
    await new Promise((r) => setTimeout(r, 400));

    const logs = await ds.getRepository(NotificationLogEntity).find({
      where: { tenantId, eventId: event.eventId, notificationType: 'SERVICE_POINTS_EARNED' },
    });
    expect(logs).toHaveLength(1);
  });
});
