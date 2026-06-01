import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { BookingReminderDueToday } from '../../../booking/domain/events/booking-reminder-due-today.event';
import { SendBookingReminderDueTodayNotificationUseCase } from '../../application/use-cases/send-booking-reminder-due-today-notification/send-booking-reminder-due-today-notification.use-case';
import { BookingReminderDueTodayHandler } from './booking-reminder-due-today.handler';

const TENANT_ID = 'aaaaaaaa-0011-4000-8000-000000000001';

const buildEvent = (): BookingReminderDueToday =>
  new BookingReminderDueToday(TENANT_ID, 'corr-reminder-due-today-1', {
    bookingId: 'bbbbbbbb-0002-4000-8000-000000000001',
    customerId: 'cccccccc-0002-4000-8000-000000000001',
    recipientEmail: 'maria@example.com',
    customerName: 'Maria Costa',
    scheduledAt: '2026-07-02T09:00:00.000Z',
    appointmentSlot: {
      startTime: '2026-07-02T09:00:00.000Z',
      endTime: '2026-07-02T10:00:00.000Z',
    },
    lines: [{ serviceId: 'ssss-0002', serviceName: 'Polimento' }],
  });

describe('BookingReminderDueTodayHandler', () => {
  let useCase: jest.Mocked<Pick<SendBookingReminderDueTodayNotificationUseCase, 'execute'>>;
  let eventBus: InMemoryEventBus;
  let handler: BookingReminderDueTodayHandler;

  beforeEach(() => {
    useCase = { execute: jest.fn().mockResolvedValue({ emailSent: true }) };
    eventBus = new InMemoryEventBus();
    handler = new BookingReminderDueTodayHandler(
      useCase as unknown as SendBookingReminderDueTodayNotificationUseCase,
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
    expect(dto.correlationId).toBe('corr-reminder-due-today-1');
    expect(dto.recipientEmail).toBe('maria@example.com');
    expect(dto.customerName).toBe('Maria Costa');
    expect(dto.scheduledAt).toBe('2026-07-02T09:00:00.000Z');
    expect(dto.lines).toHaveLength(1);
    expect(dto.lines[0].serviceName).toBe('Polimento');
  });

  it('rethrows errors from the use case', async () => {
    const err = new Error('use case failure');
    useCase.execute.mockRejectedValue(err);

    await expect(handler.handle(buildEvent())).rejects.toThrow('use case failure');
  });
});
