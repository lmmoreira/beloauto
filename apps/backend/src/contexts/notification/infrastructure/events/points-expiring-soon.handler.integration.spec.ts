import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { IEventBus } from '../../../../shared/ports/event-bus.port';
import { PointsExpiringSoon } from '../../../loyalty/domain/events/points-expiring-soon.event';
import { NotificationLogEntity } from '../entities/notification-log.entity';
import { CustomerEntity } from '../../../customer/infrastructure/entities/customer.entity';
import { CustomerEntityBuilder } from '../../../../test/builders/customer/customer-entity.builder';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { createNotificationIntegrationApp } from '../../../../test/utils/notification-integration-app';
import { waitFor } from '../../../../test/utils/wait-for';

const PLATFORM_KEY = 'pts-expiring-integration-test-key-xxxxxx';

describe('PointsExpiringSoonHandler (Pub/Sub → handler → use case → real DB) integration', () => {
  let app: INestApplication;
  let ds: DataSource;
  let dispatcher: InMemoryNotificationDispatcher;
  let eventBus: IEventBus;
  let tenantId: string;
  let customerId: string;
  let customerEmail: string;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = PLATFORM_KEY;
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-expiring-soon-${Date.now()}`;
    process.env['JWT_SECRET'] = 'pts-expiring-integration-test-secret-32c';

    dispatcher = new InMemoryNotificationDispatcher();
    ({ app, ds, eventBus } = await createNotificationIntegrationApp({
      dispatcher,
      extraEntities: [CustomerEntity],
      withTenantInterceptor: true,
    }));

    const slug = `pts-expiring-${Date.now()}`;
    const adminEmail = `admin-pts-${Date.now()}@lavacar.com.br`;

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({
        name: 'Points Expiring Integration',
        slug,
        adminEmail,
        timezone: 'America/Sao_Paulo',
      })
      .expect(201);

    tenantId = body.tenantId as string;

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'staff-invitation' },
      });
      return log !== null;
    });

    customerId = uuidv7();
    customerEmail = `customer-pts-${Date.now()}@example.com`;
    await ds
      .getRepository(CustomerEntity)
      .save(
        new CustomerEntityBuilder()
          .withId(customerId)
          .withTenantId(tenantId)
          .withEmail(customerEmail)
          .build(),
      );
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PLATFORM_ADMIN_KEY'];
    delete process.env['PUBSUB_SUBSCRIPTION_SUFFIX'];
    delete process.env['JWT_SECRET'];
  });

  afterEach(() => dispatcher.clear());

  it('PointsExpiringSoon → writes log and dispatches warning email to customer', async () => {
    const event = new PointsExpiringSoon(tenantId, uuidv7(), {
      customerId,
      pointsExpiringSoon: 30,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    await eventBus.publish(event);

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, eventId: event.eventId, notificationType: 'points-expiring-soon' },
      });
      return log !== null;
    });

    const msg = dispatcher.dispatched.find((m) => m.to === customerEmail);
    expect(msg).toBeDefined();
    expect(msg!.subject).toContain('expirar');
  });

  it('is idempotent — replaying same event produces only one notification log', async () => {
    const event = new PointsExpiringSoon(tenantId, uuidv7(), {
      customerId,
      pointsExpiringSoon: 10,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    await eventBus.publish(event);
    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, eventId: event.eventId, notificationType: 'points-expiring-soon' },
      });
      return log !== null;
    });

    await eventBus.publish(event);
    await new Promise((r) => setTimeout(r, 400));

    const logs = await ds.getRepository(NotificationLogEntity).find({
      where: { tenantId, eventId: event.eventId, notificationType: 'points-expiring-soon' },
    });
    expect(logs).toHaveLength(1);
  });

  it('dispatch failure + Pub/Sub retry → SENT log with retryCount=1 (upsert preserves failure count)', async () => {
    const event = new PointsExpiringSoon(tenantId, uuidv7(), {
      customerId,
      pointsExpiringSoon: 99,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    dispatcher.failNext(new Error('SMTP connection refused'));
    await eventBus.publish(event);

    // The FAILED state is transient (Pub/Sub retries within ~100 ms and updates the row to SENT).
    // Polling for FAILED would be a race; instead wait for the stable final state.
    // retryCount=1 is the key proof: orIgnore() would have reset it to 0 on the SENT upsert.
    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, eventId: event.eventId, notificationType: 'points-expiring-soon' },
      });
      return log !== null && log.status === 'SENT' && log.retryCount >= 1;
    });

    const log = await ds.getRepository(NotificationLogEntity).findOne({
      where: { tenantId, eventId: event.eventId, notificationType: 'points-expiring-soon' },
    });
    expect(log!.status).toBe('SENT');
    expect(log!.sentAt).toBeTruthy();
    expect(log!.retryCount).toBe(1);
  });

  it('tenant isolation: PointsExpiringSoon for Tenant A does not notify Tenant B customer', async () => {
    const tenantBSlug = `pts-expiring-b-${Date.now()}`;
    const tenantBAdminEmail = `admin-pts-b-${Date.now()}@lavacar.com.br`;
    const { body: bodyB } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({
        name: 'Points Expiring B',
        slug: tenantBSlug,
        adminEmail: tenantBAdminEmail,
        timezone: 'America/Sao_Paulo',
      })
      .expect(201);
    const tenantBId = bodyB.tenantId as string;

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId: tenantBId, notificationType: 'staff-invitation' },
      });
      return log !== null;
    });

    const tenantBCustomerEmail = `customer-pts-b-${Date.now()}@example.com`;
    await ds
      .getRepository(CustomerEntity)
      .save(
        new CustomerEntityBuilder()
          .withId(uuidv7())
          .withTenantId(tenantBId)
          .withEmail(tenantBCustomerEmail)
          .build(),
      );

    dispatcher.clear();

    const event = new PointsExpiringSoon(tenantId, uuidv7(), {
      customerId,
      pointsExpiringSoon: 25,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    await eventBus.publish(event);
    await waitFor(async () => dispatcher.dispatched.some((m) => m.to === customerEmail));

    expect(dispatcher.dispatched.some((m) => m.to === tenantBCustomerEmail)).toBe(false);
    expect(dispatcher.dispatched.some((m) => m.to === customerEmail)).toBe(true);
  });
});
