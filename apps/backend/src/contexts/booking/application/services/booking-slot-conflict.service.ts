import { Inject, Injectable } from '@nestjs/common';
import { utcDateToLocalDate } from '../../../../shared/utils/calendar-date';
import { BookingSlotUnavailableError } from '../../domain/errors/booking-domain.error';
import {
  IBookingAvailabilityPort,
  BOOKING_AVAILABILITY_PORT,
} from '../ports/booking-availability.port';
import {
  IScheduleTenantSettingsPort,
  SCHEDULE_TENANT_SETTINGS_PORT,
} from '../ports/schedule-tenant-settings.port';

@Injectable()
export class BookingSlotConflictService {
  constructor(
    @Inject(BOOKING_AVAILABILITY_PORT)
    private readonly availabilityPort: IBookingAvailabilityPort,
    @Inject(SCHEDULE_TENANT_SETTINGS_PORT)
    private readonly settingsPort: IScheduleTenantSettingsPort,
  ) {}

  async assertSlotFree(
    tenantId: string,
    scheduledAt: Date,
    totalDurationMins: number,
  ): Promise<void> {
    const { businessHours } = await this.settingsPort.getSchedulingSettings(tenantId);
    const localDate = utcDateToLocalDate(scheduledAt, businessHours.timezone);
    const existingSlots = await this.availabilityPort.findApprovedByTenantAndDate(
      tenantId,
      localDate,
    );
    const bookingEnd = scheduledAt.getTime() + totalDurationMins * 60_000;
    const hasConflict = existingSlots.some((slot) => {
      const slotEnd = slot.scheduledAt.getTime() + slot.totalDurationMins * 60_000;
      return slot.scheduledAt.getTime() < bookingEnd && scheduledAt.getTime() < slotEnd;
    });
    if (hasConflict) throw new BookingSlotUnavailableError();
  }
}
