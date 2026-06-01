import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { BookingReminderDue } from '../../../booking/domain/events/booking-reminder-due.event';
import { SendBookingReminderDueNotificationUseCase } from '../../application/use-cases/send-booking-reminder-due-notification/send-booking-reminder-due-notification.use-case';
import { BookingReminderDueHandler } from './booking-reminder-due.handler';

const TENANT_ID = 'aaaaaaaa-0010-4000-8000-000000000001';

const buildEvent = (): BookingReminderDue =>
  new BookingReminderDue(TENANT_ID, 'corr-reminder-due-1', {
    bookingId: 'bbbbbbbb-0001-4000-8000-000000000001',
    customerId: 'cccccccc-0001-4000-8000-000000000001',
    recipientEmail: 'joao@example.com',
    customerName: 'João Silva',
    scheduledAt: '2026-07-02T13:00:00.000Z',
    appointmentSlot: {
      startTime: '2026-07-02T13:00:00.000Z',
      endTime: '2026-07-02T14:00:00.000Z',
    },
    lines: [{ serviceId: 'ssss-0001', serviceName: 'Lavagem Completa' }],
  });

describe('BookingReminderDueHandler', () => {
  let useCase: jest.Mocked<Pick<SendBookingReminderDueNotificationUseCase, 'execute'>>;
  let eventBus: InMemoryEventBus;
  let handler: BookingReminderDueHandler;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue({ emailSent: true }) };
    eventBus = new InMemoryEventBus();
    handler = new BookingReminderDueHandler(
      useCase as unknown as SendBookingReminderDueNotificationUseCase,
      eventBus,
    );
    handler.onModuleInit();
  });

  afterEach(() => jest.resetAllMocks());

  it('delegates to use case with correct dto fields', async () => {
    const event = buildEvent();

    await handler.handle(event);

    expect(useCase.execute).toHaveBeenCalledTimes(1);
    const dto = useCase.execute.mock.calls[0][0];
    expect(dto.tenantId).toBe(TENANT_ID);
    expect(dto.correlationId).toBe('corr-reminder-due-1');
    expect(dto.recipientEmail).toBe('joao@example.com');
    expect(dto.customerName).toBe('João Silva');
    expect(dto.scheduledAt).toBe('2026-07-02T13:00:00.000Z');
    expect(dto.lines).toHaveLength(1);
    expect(dto.lines[0].serviceName).toBe('Lavagem Completa');
  });

  it('rethrows errors from the use case', async () => {
    const err = new Error('use case failure');
    useCase.execute.mockRejectedValue(err);

    await expect(handler.handle(buildEvent())).rejects.toThrow('use case failure');
  });
});
