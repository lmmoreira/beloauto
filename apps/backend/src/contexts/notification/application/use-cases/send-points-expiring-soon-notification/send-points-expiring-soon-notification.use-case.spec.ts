import { InMemoryNotificationCustomerPort } from '../../../../../test/infrastructure/in-memory-notification-customer.port';
import { InMemoryNotificationDispatcher } from '../../../../../test/infrastructure/in-memory-notification-dispatcher';
import { InMemoryNotificationLogRepository } from '../../../../../test/repositories/notification/in-memory-notification-log.repository';
import { InMemoryNotificationProcessedEventRepository } from '../../../../../test/repositories/notification/in-memory-processed-event.repository';
import { InMemoryTransactionManager } from '../../../../../test/infrastructure/in-memory-transaction-manager';
import { SendPointsExpiringSoonNotificationDtoBuilder } from '../../../../../test/builders/notification/index';
import { SendPointsExpiringSoonNotificationUseCase } from './send-points-expiring-soon-notification.use-case';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000001603';
const CUSTOMER_ID = 'cccccccc-0000-4000-8000-000000001603';
const EVENT_ID = 'eeeeeeee-0000-4000-8000-000000001603';

const dto = new SendPointsExpiringSoonNotificationDtoBuilder()
  .withTenantId(TENANT_ID)
  .withEventId(EVENT_ID)
  .withCustomerId(CUSTOMER_ID)
  .withPointsExpiringSoon(20)
  .build();

describe('SendPointsExpiringSoonNotificationUseCase', () => {
  let useCase: SendPointsExpiringSoonNotificationUseCase;
  let dispatcher: InMemoryNotificationDispatcher;
  let logRepo: InMemoryNotificationLogRepository;
  let processedEventRepo: InMemoryNotificationProcessedEventRepository;
  let customerPort: InMemoryNotificationCustomerPort;

  beforeEach(() => {
    dispatcher = new InMemoryNotificationDispatcher();
    logRepo = new InMemoryNotificationLogRepository();
    processedEventRepo = new InMemoryNotificationProcessedEventRepository();
    customerPort = new InMemoryNotificationCustomerPort();

    customerPort.setCustomer(TENANT_ID, CUSTOMER_ID, {
      email: 'joao@example.com',
      name: 'João Silva',
    });

    useCase = new SendPointsExpiringSoonNotificationUseCase(
      logRepo,
      processedEventRepo,
      dispatcher,
      customerPort,
      new InMemoryTransactionManager(),
    );
  });

  afterEach(() => jest.resetAllMocks());

  it('dispatches email with correct subject and template data', async () => {
    const result = await useCase.execute(dto);

    expect(result.emailSent).toBe(true);
    expect(dispatcher.dispatched).toHaveLength(1);
    const msg = dispatcher.dispatched[0];
    expect(msg.to).toBe('joao@example.com');
    expect(msg.subject).toBe('Seus pontos de fidelidade estão prestes a expirar!');
    expect(msg.templateKey).toBe('points-expiring-soon');
    expect(msg.data['customerName']).toBe('João Silva');
    expect(msg.data['pointsExpiringSoon']).toBe(20);
  });

  it('saves a notification log entry', async () => {
    await useCase.execute(dto);

    expect(logRepo.all).toHaveLength(1);
    expect(logRepo.all[0].notificationType).toBe('points-expiring-soon');
    expect(logRepo.all[0].tenantId).toBe(TENANT_ID);
  });

  it('is idempotent — second call returns emailSent=false without re-dispatching', async () => {
    await useCase.execute(dto);
    const second = await useCase.execute(dto);

    expect(second.emailSent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(1);
  });

  it('returns emailSent=false and skips dispatch when customer is not found', async () => {
    const result = await useCase.execute(
      new SendPointsExpiringSoonNotificationDtoBuilder()
        .withTenantId(TENANT_ID)
        .withEventId('eeeeeeee-0099-4000-8000-000000001603')
        .withCustomerId('unknown-customer-id')
        .build(),
    );

    expect(result.emailSent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(0);
  });
});
