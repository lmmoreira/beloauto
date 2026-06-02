import { INestApplication } from '@nestjs/common';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { IEventBus } from '../../../../shared/ports/event-bus.port';
import { NOTIFICATION_CUSTOMER_PORT } from '../../application/ports/notification-customer.port';
import { PointsExpiringSoon } from '../../../loyalty/domain/events/points-expiring-soon.event';
import { InMemoryNotificationCustomerPort } from '../../../../test/infrastructure/in-memory-notification-customer.port';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { createNotificationIntegrationApp } from '../../../../test/utils/notification-integration-app';
import { waitFor } from '../../../../test/utils/wait-for';

const TENANT_A = 'aaaaaaaa-1600-4000-8000-000000000001';
const TENANT_B = 'bbbbbbbb-1600-4000-8000-000000000001';
const CUSTOMER_A = 'cccccccc-1600-4000-8000-000000000001';

describe('PointsExpiringSoonHandler (Pub/Sub → handler → use case → dispatcher) integration', () => {
  let app: INestApplication;
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

    ({ app, eventBus } = await createNotificationIntegrationApp({
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

    await waitFor(async () => dispatcher.dispatched.length >= 1);

    expect(dispatcher.dispatched[0].subject).toBe(
      'Seus pontos de fidelidade estão prestes a expirar!',
    );
    expect(dispatcher.dispatched[0].to).toBe('joao@example.com');
    expect(dispatcher.dispatched[0].data['pointsExpiringSoon']).toBe(30);
  });

  it('is idempotent — publishing same event twice dispatches only one email', async () => {
    const eventId = uuidv7();
    const event = new PointsExpiringSoon(TENANT_A, uuidv7(), {
      customerId: CUSTOMER_A,
      pointsExpiringSoon: 10,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });
    Object.assign(event, { eventId });

    await eventBus.publish(event);
    await waitFor(async () => dispatcher.dispatched.length >= 1);

    dispatcher.clear();

    const duplicate = new PointsExpiringSoon(TENANT_A, uuidv7(), {
      customerId: CUSTOMER_A,
      pointsExpiringSoon: 10,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });
    Object.assign(duplicate, { eventId });
    await eventBus.publish(duplicate);

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(dispatcher.dispatched).toHaveLength(0);
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

    await waitFor(async () => dispatcher.dispatched.length >= 1);

    expect(dispatcher.dispatched.every((m) => m.to === 'joao@example.com')).toBe(true);
    expect(dispatcher.dispatched.some((m) => m.to === 'tenantb@example.com')).toBe(false);
  });
});
