import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AdminScheduleReminderJob } from '../../application/jobs/admin-schedule-reminder.job';
import { BookingReminderJob } from '../../application/jobs/booking-reminder.job';

// MVP: no auth guard — backend is not publicly reachable (BFF-only path).
// M115-S03 adds CronAuthGuard (OIDC token from GCP Cloud Scheduler).
@Controller('cron')
export class CronBookingController {
  constructor(
    private readonly bookingReminderJob: BookingReminderJob,
    private readonly adminScheduleReminderJob: AdminScheduleReminderJob,
  ) {}

  @Post('reminders')
  @HttpCode(HttpStatus.OK)
  async reminders(): Promise<{ ok: boolean }> {
    await this.bookingReminderJob.run();
    await this.adminScheduleReminderJob.run();
    return { ok: true };
  }
}
