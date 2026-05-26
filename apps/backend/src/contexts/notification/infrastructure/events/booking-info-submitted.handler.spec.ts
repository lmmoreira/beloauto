import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { BookingInfoSubmittedEventBuilder } from '../../../../test/builders/booking/booking-info-submitted-event.builder';
import { SendBookingInfoSubmittedNotificationUseCase } from '../../application/use-cases/send-booking-info-submitted-notification/send-booking-info-submitted-notification.use-case';
import { BookingInfoSubmittedHandler } from './booking-info-submitted.handler';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000014';

describe('BookingInfoSubmittedHandler', () => {
  let useCase: jest.Mocked<Pick<SendBookingInfoSubmittedNotificationUseCase, 'execute'>>;
  let eventBus: InMemoryEventBus;
  let handler: BookingInfoSubmittedHandler;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue({ emailSent: true }) };
    eventBus = new InMemoryEventBus();
    handler = new BookingInfoSubmittedHandler(
      useCase as unknown as SendBookingInfoSubmittedNotificationUseCase,
      eventBus,
    );
    handler.onModuleInit();
  });

  it('delegates to use case with correct dto fields', async () => {
    const event = new BookingInfoSubmittedEventBuilder().withTenantId(TENANT_ID).build();

    await handler.handle(event);

    expect(useCase.execute).toHaveBeenCalledTimes(1);
    const dto = useCase.execute.mock.calls[0][0];
    expect(dto.tenantId).toBe(TENANT_ID);
    expect(dto.submittedByEmail).toBe('joao@example.com');
    expect(dto.infoPayload).toEqual({
      notes: 'Aqui estão as fotos do veículo conforme solicitado',
    });
  });

  it('rethrows errors from the use case', async () => {
    const err = new Error('use case failure');
    useCase.execute.mockRejectedValue(err);

    await expect(
      handler.handle(new BookingInfoSubmittedEventBuilder().withTenantId(TENANT_ID).build()),
    ).rejects.toThrow('use case failure');
  });
});
