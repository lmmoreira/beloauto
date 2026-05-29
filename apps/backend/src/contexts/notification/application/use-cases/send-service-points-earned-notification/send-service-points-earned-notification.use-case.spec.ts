import { InMemoryNotificationCustomerPort } from '../../../../../test/infrastructure/in-memory-notification-customer.port';
import { InMemoryNotificationDispatcher } from '../../../../../test/infrastructure/in-memory-notification-dispatcher';
import { InMemoryNotificationLogRepository } from '../../../../../test/repositories/notification/in-memory-notification-log.repository';
import { InMemoryNotificationServicePort } from '../../../../../test/infrastructure/in-memory-notification-service.port';
import { InMemoryTransactionManager } from '../../../../../test/infrastructure/in-memory-transaction-manager';
import { SendServicePointsEarnedNotificationDto } from '../../dtos/send-service-points-earned-notification.dto';
import { SendServicePointsEarnedNotificationUseCase } from './send-service-points-earned-notification.use-case';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CUSTOMER_ID = 'cccccccc-0000-4000-8000-000000000001';
const SERVICE_ID = 'ssssssss-0000-4000-8000-000000000001';
const EVENT_ID = 'eeeeeeee-0000-4000-8000-000000000001';
const CORRELATION_ID = 'corr-0000-4000-8000-000000000001';

function makeDto(
  overrides: Partial<SendServicePointsEarnedNotificationDto> = {},
): SendServicePointsEarnedNotificationDto {
  return {
    tenantId: TENANT_ID,
    eventId: EVENT_ID,
    correlationId: CORRELATION_ID,
    customerId: CUSTOMER_ID,
    serviceId: SERVICE_ID,
    pointsEarned: 10,
    earnedAt: '2026-06-01T10:00:00.000Z',
    expiresAt: '2026-11-28T10:00:00.000Z',
    currentBalance: 10,
    ...overrides,
  };
}

describe('SendServicePointsEarnedNotificationUseCase', () => {
  let useCase: SendServicePointsEarnedNotificationUseCase;
  let dispatcher: InMemoryNotificationDispatcher;
  let logRepo: InMemoryNotificationLogRepository;
  let customerPort: InMemoryNotificationCustomerPort;
  let servicePort: InMemoryNotificationServicePort;

  beforeEach(() => {
    dispatcher = new InMemoryNotificationDispatcher();
    logRepo = new InMemoryNotificationLogRepository();
    customerPort = new InMemoryNotificationCustomerPort();
    servicePort = new InMemoryNotificationServicePort();

    customerPort.setCustomer(TENANT_ID, CUSTOMER_ID, {
      email: 'maria@example.com',
      name: 'Maria Silva',
    });
    servicePort.setService(TENANT_ID, {
      serviceId: SERVICE_ID,
      serviceName: 'Lavagem Premium',
    });

    useCase = new SendServicePointsEarnedNotificationUseCase(
      logRepo,
      dispatcher,
      customerPort,
      servicePort,
      new InMemoryTransactionManager(),
    );
  });

  afterEach(() => jest.resetAllMocks());

  it('dispatches email to customer with correct subject and template data', async () => {
    const result = await useCase.execute(makeDto());

    expect(result.emailSent).toBe(true);
    expect(dispatcher.dispatched).toHaveLength(1);
    const msg = dispatcher.dispatched[0];
    expect(msg.to).toBe('maria@example.com');
    expect(msg.subject).toContain('10 pontos');
    expect(msg.templateKey).toBe('service-points-earned');
    expect(msg.data['customerName']).toBe('Maria Silva');
    expect(msg.data['serviceName']).toBe('Lavagem Premium');
    expect(msg.data['pointsEarned']).toBe(10);
    expect(msg.data['currentBalance']).toBe(10);
  });

  it('saves a notification log entry', async () => {
    await useCase.execute(makeDto());

    const log = await logRepo.findByEventAndChannel(
      TENANT_ID,
      EVENT_ID,
      'SERVICE_POINTS_EARNED',
      'EMAIL',
    );
    expect(log).not.toBeNull();
  });

  it('is idempotent — second call returns emailSent=false without re-dispatching', async () => {
    await useCase.execute(makeDto());
    const second = await useCase.execute(makeDto());

    expect(second.emailSent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(1);
  });

  it('returns emailSent=false and skips dispatch when customer is not found', async () => {
    const result = await useCase.execute(makeDto({ customerId: 'unknown-customer-id' }));

    expect(result.emailSent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(0);
  });

  it('falls back to serviceId string when service is not found', async () => {
    const unknownServiceId = 'unknown-service-id';
    await useCase.execute(makeDto({ serviceId: unknownServiceId }));

    const msg = dispatcher.dispatched[0];
    expect(msg.data['serviceName']).toBe(unknownServiceId);
  });
});
