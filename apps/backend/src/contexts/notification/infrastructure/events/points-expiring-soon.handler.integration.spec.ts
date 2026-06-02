import { INestApplication } from '@nestjs/common';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { IEventBus } from '../../../../shared/ports/event-bus.port';
import { NOTIFICATION_CUSTOMER_PORT } from '../../application/ports/notification-customer.port';
import { NotificationLogEntity } from '../../infrastructure/entities/notification-log.entity';
import { PointsExpiringSoon } from '../../../loyalty/domain/events/points-expiring-soon.event';
import { InMemoryNotificationCustomerPort } from '../../../../test/infrastructure/in-memory-notification-customer.port';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { createNotificationIntegrationApp } from '../../../../test/utils/notification-integration-app';
import { waitFor } from '../../../../test/utils/wait-for';
import { DataSource } from 'typeorm';

const TENANT_A = 'aaaaaaaa-1600-4000-8000-000000000001';
const TENANT_B = 'bbbbbbbb-1600-4000-8000-000000000001';
const CUSTOMER_A = 'cccccccc-1600-4000-8000-000000000001';

describe('PointsExpiringSoonHandler (Pub/Sub → handler → use case → dispatcher) integration', () => {
  let app: INestApplication;
  let ds: DataSource;
  let dispatcher: InMemoryNotificationDispatcher;
  let customerPort: InMemoryNotificationCustomerPort;
  let eventBus: IEventBus;

  beforeAll(async () => {
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-expiring-soon-${Date.now()}`;

    dispatcher = new InMemoryNotificationDispatcher();
    customerPort = new InMemoryNotificationCustomerPort();

    customerPort.setCustomer(TENANT_A, CUSTOMER_A, {
      email: 'joao@example.com',
      name: 'João Silva',
    });

    ({ app, ds, eventBus } = await createNotificationIntegrationApp({
      dispatcher,
      configure: (builder) =>
        builder.overrideProvider(NOTIFICATION_CUSTOMER_PORT).useValue(customerPort),
    }));
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PUBSUB_SUBSCRIPTION_SUFFIX'];
  });

  afterEach(() => dispatcher.clear());

  it('PointsExpiringSoon → dispatches warning email to customer', async () => {
    const event = new PointsExpiringSoon(TENANT_A, uuidv7(), {
      customerId: CUSTOMER_A,
      pointsExpiringSoon: 30,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    await eventBus.publish(event);

    // Filter by recipient to be tolerant of cross-spec Pub/Sub fan-out noise
    await waitFor(async () => dispatcher.dispatched.some((m) => m.to === 'joao@example.com'));

    const msg = dispatcher.dispatched.find((m) => m.to === 'joao@example.com')!;
    expect(msg.subject).toBe('Seus pontos de fidelidade estão prestes a expirar!');
    expect(msg.data['pointsExpiringSoon']).toBe(30);
  });

  it('is idempotent — publishing same event twice writes only one notification log', async () => {
    const event = new PointsExpiringSoon(TENANT_A, uuidv7(), {
      customerId: CUSTOMER_A,
      pointsExpiringSoon: 10,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    await eventBus.publish(event);
    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: {
          tenantId: TENANT_A,
          eventId: event.eventId,
          notificationType: 'points-expiring-soon',
        },
      });
      return log !== null;
    });

    await eventBus.publish(event);

    await new Promise((resolve) => setTimeout(resolve, 400));

    const logs = await ds.getRepository(NotificationLogEntity).find({
      where: {
        tenantId: TENANT_A,
        eventId: event.eventId,
        notificationType: 'points-expiring-soon',
      },
    });
    expect(logs).toHaveLength(1);
  });

  it('tenant isolation: Tenant A event does not dispatch to Tenant B customer', async () => {
    customerPort.setCustomer(TENANT_B, CUSTOMER_A, {
      email: 'tenantb@example.com',
      name: 'Tenant B Customer',
    });

    const event = new PointsExpiringSoon(TENANT_A, uuidv7(), {
      customerId: CUSTOMER_A,
      pointsExpiringSoon: 25,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    await eventBus.publish(event);

    await waitFor(async () => dispatcher.dispatched.some((m) => m.to === 'joao@example.com'));

    expect(dispatcher.dispatched.some((m) => m.to === 'tenantb@example.com')).toBe(false);
    expect(dispatcher.dispatched.some((m) => m.to === 'joao@example.com')).toBe(true);
  });
});
