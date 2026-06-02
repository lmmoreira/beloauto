import { INestApplication } from '@nestjs/common';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { IEventBus } from '../../../../shared/ports/event-bus.port';
import { NOTIFICATION_CUSTOMER_PORT } from '../../application/ports/notification-customer.port';
import { NOTIFICATION_STAFF_PORT } from '../../application/ports/notification-staff.port';
import { NOTIFICATION_TENANT_PORT } from '../../application/ports/notification-tenant.port';
import { NOTIFICATION_SERVICE_PORT } from '../../application/ports/notification-service.port';
import { NOTIFICATION_LOG_REPOSITORY } from '../../application/ports/notification-log-repository.port';
import { NOTIFICATION_PROCESSED_EVENT_REPOSITORY } from '../../application/ports/processed-event-repository.port';
import { NOTIFICATION_TEMPLATE_REPOSITORY } from '../../application/ports/notification-template-repository.port';
import { PointsExpiringSoon } from '../../../loyalty/domain/events/points-expiring-soon.event';
import { NotificationTemplate } from '../../domain/notification-template.aggregate';
import { NotificationTemplateKey } from '../../domain/notification-template-key.enum';
import { InMemoryNotificationCustomerPort } from '../../../../test/infrastructure/in-memory-notification-customer.port';
import { InMemoryNotificationStaffPort } from '../../../../test/infrastructure/in-memory-notification-staff.port';
import { InMemoryNotificationTenantPort } from '../../../../test/infrastructure/in-memory-notification-tenant.port';
import { InMemoryNotificationServicePort } from '../../../../test/infrastructure/in-memory-notification-service.port';
import { InMemoryNotificationLogRepository } from '../../../../test/repositories/notification/in-memory-notification-log.repository';
import { InMemoryNotificationProcessedEventRepository } from '../../../../test/repositories/notification/in-memory-processed-event.repository';
import { InMemoryNotificationTemplateRepository } from '../../../../test/repositories/notification/in-memory-notification-template.repository';
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
  let logRepo: InMemoryNotificationLogRepository;
  let processedEventRepo: InMemoryNotificationProcessedEventRepository;
  let eventBus: IEventBus;

  beforeAll(async () => {
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-expiring-soon-${Date.now()}`;

    dispatcher = new InMemoryNotificationDispatcher();
    customerPort = new InMemoryNotificationCustomerPort();
    logRepo = new InMemoryNotificationLogRepository();
    processedEventRepo = new InMemoryNotificationProcessedEventRepository();

    customerPort.setCustomer(TENANT_A, CUSTOMER_A, {
      email: 'joao@example.com',
      name: 'João Silva',
    });

    const templateRepo = new InMemoryNotificationTemplateRepository();
    templateRepo.seed(
      NotificationTemplate.create({
        tenantId: TENANT_A,
        triggerEvent: NotificationTemplateKey.POINTS_EXPIRING_SOON,
        channel: 'EMAIL',
        subject: 'Seus pontos de fidelidade estão prestes a expirar!',
        body: '<p>Olá, {{customerName}}! Você tem {{pointsExpiringSoon}} pontos prestes a expirar em {{earliestExpiresAt}}.</p>',
      }),
    );

    // Use InMemory log, processed-event, and template repos so this spec never touches the real
    // DB for notification data. This prevents cross-spec Pub/Sub fan-out from contaminating
    // notification_logs counts in other parallel specs.
    ({ app, eventBus } = await createNotificationIntegrationApp({
      dispatcher,
      configure: (builder) =>
        builder
          .overrideProvider(NOTIFICATION_CUSTOMER_PORT)
          .useValue(customerPort)
          .overrideProvider(NOTIFICATION_STAFF_PORT)
          .useValue(new InMemoryNotificationStaffPort())
          .overrideProvider(NOTIFICATION_TENANT_PORT)
          .useValue(new InMemoryNotificationTenantPort())
          .overrideProvider(NOTIFICATION_SERVICE_PORT)
          .useValue(new InMemoryNotificationServicePort())
          .overrideProvider(NOTIFICATION_LOG_REPOSITORY)
          .useValue(logRepo)
          .overrideProvider(NOTIFICATION_PROCESSED_EVENT_REPOSITORY)
          .useValue(processedEventRepo)
          .overrideProvider(NOTIFICATION_TEMPLATE_REPOSITORY)
          .useValue(templateRepo),
    }));
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PUBSUB_SUBSCRIPTION_SUFFIX'];
  });

  afterEach(() => {
    dispatcher.clear();
    processedEventRepo.clear();
  });

  it('PointsExpiringSoon → dispatches warning email to customer', async () => {
    const event = new PointsExpiringSoon(TENANT_A, uuidv7(), {
      customerId: CUSTOMER_A,
      pointsExpiringSoon: 30,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    await eventBus.publish(event);

    await waitFor(async () => dispatcher.dispatched.some((m) => m.to === 'joao@example.com'));

    const msg = dispatcher.dispatched.find((m) => m.to === 'joao@example.com')!;
    expect(msg.subject).toBe('Seus pontos de fidelidade estão prestes a expirar!');
    expect(msg.subject).toBe('Seus pontos de fidelidade estão prestes a expirar!');
  });

  it('is idempotent — publishing same event twice writes only one notification log', async () => {
    const event = new PointsExpiringSoon(TENANT_A, uuidv7(), {
      customerId: CUSTOMER_A,
      pointsExpiringSoon: 10,
      earliestExpiresAt: '2026-06-09T00:00:00.000Z',
    });

    await eventBus.publish(event);
    await waitFor(async () =>
      logRepo.all.some(
        (l) => l.eventId === event.eventId && l.notificationType === 'points-expiring-soon',
      ),
    );

    await eventBus.publish(event);

    await new Promise((resolve) => setTimeout(resolve, 400));

    const logs = logRepo.all.filter(
      (l) => l.eventId === event.eventId && l.notificationType === 'points-expiring-soon',
    );
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
