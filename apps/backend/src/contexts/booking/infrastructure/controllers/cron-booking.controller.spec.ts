import { CronBookingController } from './cron-booking.controller';
import { BookingReminderJob } from '../../application/jobs/booking-reminder.job';
import { AdminScheduleReminderJob } from '../../application/jobs/admin-schedule-reminder.job';

describe('CronBookingController', () => {
  let controller: CronBookingController;
  let bookingReminderJob: jest.Mocked<BookingReminderJob>;
  let adminScheduleReminderJob: jest.Mocked<AdminScheduleReminderJob>;

  beforeEach(() => {
    bookingReminderJob = {
      run: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BookingReminderJob>;
    adminScheduleReminderJob = {
      run: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AdminScheduleReminderJob>;
    controller = new CronBookingController(bookingReminderJob, adminScheduleReminderJob);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns { ok: true }', async () => {
    const result = await controller.reminders();
    expect(result).toEqual({ ok: true });
  });

  it('calls BookingReminderJob.run()', async () => {
    await controller.reminders();
    expect(bookingReminderJob.run).toHaveBeenCalledTimes(1);
  });

  it('calls AdminScheduleReminderJob.run()', async () => {
    await controller.reminders();
    expect(adminScheduleReminderJob.run).toHaveBeenCalledTimes(1);
  });

  it('runs booking job before admin job', async () => {
    const order: string[] = [];
    bookingReminderJob.run.mockImplementation(async () => {
      order.push('booking');
    });
    adminScheduleReminderJob.run.mockImplementation(async () => {
      order.push('admin');
    });

    await controller.reminders();

    expect(order).toEqual(['booking', 'admin']);
  });
});
