import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { BookingRequested } from '../../../booking/domain/events/booking-requested.event';
import { SendBookingRequestedNotificationUseCase } from '../../application/use-cases/send-booking-requested-notification/send-booking-requested-notification.use-case';
import { BookingRequestedHandler } from './booking-requested.handler';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

function makeEvent(): BookingRequested {
  return new BookingRequested(TENANT_ID, 'corr-1', {
    bookingId: 'dddddddd-0000-4000-8000-000000000001',
    type: 'GUEST',
    customerId: null,
    guestEmail: 'joao@example.com',
    guestName: 'João Silva',
    guestPhone: '+5531999999999',
    guestAddress: null,
    scheduledAt: '2026-06-15T13:00:00.000Z',
    totalDurationMins: 60,
    totalPrice: { amount: '150.00', currency: 'BRL' },
    requiresPickup: false,
    pickupAddress: null,
    lines: [
      {
        lineId: 'eeeeeeee-0000-4000-8000-000000000001',
        serviceId: 'ffffffff-0000-4000-8000-000000000001',
        serviceNameAtBooking: 'Lavagem Completa',
        priceAtBooking: { amount: '150.00', currency: 'BRL' },
        durationMinsAtBooking: 60,
        pointsValueAtBooking: 1,
        requiresPickupAddressAtBooking: false,
      },
    ],
    beforeServicePhotoUrls: [],
  });
  // Set eventId via the parent DomainEvent — we can't override it here but tests
  // use the auto-generated value to verify delegation
}

describe('BookingRequestedHandler', () => {
  let useCase: jest.Mocked<Pick<SendBookingRequestedNotificationUseCase, 'execute'>>;
  let eventBus: InMemoryEventBus;
  let handler: BookingRequestedHandler;

  beforeEach(() => {
    useCase = {
      execute: jest.fn().mockResolvedValue({ adminEmailSent: true, customerEmailSent: true }),
    };
    eventBus = new InMemoryEventBus();
    handler = new BookingRequestedHandler(
      useCase as unknown as SendBookingRequestedNotificationUseCase,
      eventBus,
    );
    handler.onModuleInit();
  });

  it('delegates to use case with correct dto fields', async () => {
    const event = makeEvent();

    await handler.handle(event);

    expect(useCase.execute).toHaveBeenCalledTimes(1);
    const dto = useCase.execute.mock.calls[0][0];
    expect(dto.tenantId).toBe(TENANT_ID);
    expect(dto.correlationId).toBe('corr-1');
    expect(dto.guestEmail).toBe('joao@example.com');
    expect(dto.guestName).toBe('João Silva');
    expect(dto.scheduledAt).toBe('2026-06-15T13:00:00.000Z');
    expect(dto.totalPrice).toEqual({ amount: '150.00', currency: 'BRL' });
    expect(dto.lines).toEqual([{ serviceNameAtBooking: 'Lavagem Completa' }]);
    expect(dto.pickupAddress).toBeNull();
  });

  it('rethrows errors from the use case', async () => {
    const err = new Error('use case failure');
    useCase.execute.mockRejectedValue(err);

    await expect(handler.handle(makeEvent())).rejects.toThrow('use case failure');
  });
});
