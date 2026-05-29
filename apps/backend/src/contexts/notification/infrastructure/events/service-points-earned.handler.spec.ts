import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { ServicePointsEarnedEventBuilder } from '../../../../test/builders/loyalty/index';
import { SendServicePointsEarnedNotificationUseCase } from '../../application/use-cases/send-service-points-earned-notification/send-service-points-earned-notification.use-case';
import { ServicePointsEarnedHandler } from './service-points-earned.handler';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000011';

describe('ServicePointsEarnedHandler', () => {
  let useCase: jest.Mocked<Pick<SendServicePointsEarnedNotificationUseCase, 'execute'>>;
  let eventBus: InMemoryEventBus;
  let handler: ServicePointsEarnedHandler;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue({ emailSent: true }) };
    eventBus = new InMemoryEventBus();
    handler = new ServicePointsEarnedHandler(
      useCase as unknown as SendServicePointsEarnedNotificationUseCase,
      eventBus,
    );
    handler.onModuleInit();
  });

  afterEach(() => jest.resetAllMocks());

  it('delegates to use case with correct booking-level dto', async () => {
    const event = new ServicePointsEarnedEventBuilder().withTenantId(TENANT_ID).build();

    await handler.handle(event);

    expect(useCase.execute).toHaveBeenCalledTimes(1);
    const dto = useCase.execute.mock.calls[0][0];
    expect(dto.tenantId).toBe(TENANT_ID);
    expect(dto.eventId).toBe(event.eventId);
    expect(dto.correlationId).toBe('corr-points-1');
    expect(dto.customerId).toBe('cccccccc-0001-4000-8000-000000000001');
    expect(dto.bookingId).toBe('bbbbbbbb-0001-4000-8000-000000000001');
    expect(dto.totalPointsEarned).toBe(10);
    expect(dto.lines).toHaveLength(1);
    expect(dto.currentBalance).toBe(10);
  });

  it('rethrows errors from the use case', async () => {
    const err = new Error('use case failure');
    useCase.execute.mockRejectedValue(err);

    await expect(
      handler.handle(new ServicePointsEarnedEventBuilder().withTenantId(TENANT_ID).build()),
    ).rejects.toThrow('use case failure');
  });
});
