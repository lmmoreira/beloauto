import { DateTime } from 'luxon';
import {
  BookingSettings,
  BusinessHours,
  DayHours,
} from '../../../../contexts/platform/domain/value-objects/tenant-settings.vo';
import { BookedSlot } from '../booked-slot';
import { ScheduleClosure } from '../schedule-closure.aggregate';
import { ScheduleOpening } from '../schedule-opening.aggregate';

export interface ServiceDuration {
  durationMinutes: number;
}

export interface AvailabilityInput {
  date: string; // YYYY-MM-DD in tenant timezone
  services: ServiceDuration[];
  businessHours: BusinessHours;
  slotGranularityMinutes: BookingSettings['slot_granularity_minutes'];
  serviceBufferMinutes: number;
  closures: ScheduleClosure[];
  opening: ScheduleOpening | null;
  existingBookings: BookedSlot[];
}

export interface AvailableSlot {
  startsAt: string; // ISO-8601 UTC
  endsAt: string; // ISO-8601 UTC
}

type WeekDay = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

const DAY_NAMES: WeekDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export class AvailabilityService {
  calculate(input: AvailabilityInput): AvailableSlot[] {
    const {
      date,
      services,
      businessHours,
      slotGranularityMinutes,
      serviceBufferMinutes,
      closures,
      opening,
      existingBookings,
    } = input;

    const effectiveHours = this.resolveEffectiveHours(date, businessHours, closures, opening);
    if (!effectiveHours) return [];

    const { open, close, partialClosures } = effectiveHours;
    const timezone = businessHours.timezone;

    const totalMins =
      services.reduce((sum, s) => sum + s.durationMinutes, 0) + serviceBufferMinutes;

    const bookedRanges = existingBookings.map((b) => {
      const startHHMM = this.utcToLocalHHMM(b.scheduledAt, timezone);
      return {
        start: startHHMM,
        end: this.addMinsToHHMM(startHHMM, b.totalDurationMins),
      };
    });

    const slots: AvailableSlot[] = [];
    let cursor = this.hhmmToMins(open);
    const closeMins = this.hhmmToMins(close);

    while (cursor + totalMins <= closeMins) {
      const startHHMM = this.minsToHHMM(cursor);
      const endHHMM = this.minsToHHMM(cursor + totalMins);

      const blockedByClosure = partialClosures.some((c) =>
        this.overlaps(startHHMM, endHHMM, c.startTime!.value, c.endTime!.value),
      );

      const blockedByBooking = bookedRanges.some((b) =>
        this.overlaps(startHHMM, endHHMM, b.start, b.end),
      );

      if (!blockedByClosure && !blockedByBooking) {
        slots.push({
          startsAt: this.toUTCIso(date, startHHMM, timezone),
          endsAt: this.toUTCIso(date, endHHMM, timezone),
        });
      }

      cursor += slotGranularityMinutes;
    }

    return slots;
  }

  private resolveEffectiveHours(
    date: string,
    businessHours: BusinessHours,
    closures: ScheduleClosure[],
    opening: ScheduleOpening | null,
  ): { open: string; close: string; partialClosures: ScheduleClosure[] } | null {
    if (opening) {
      return { open: opening.startTime.value, close: opening.endTime.value, partialClosures: [] };
    }

    const [year, month, day] = date.split('-').map(Number) as [number, number, number];
    const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const dayHours: DayHours = businessHours[DAY_NAMES[dayIndex]];

    if (!dayHours) return null;

    if (closures.some((c) => c.isFullDay())) return null;

    return {
      open: dayHours.open,
      close: dayHours.close,
      partialClosures: closures.filter((c) => !c.isFullDay()),
    };
  }

  private hhmmToMins(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number) as [number, number];
    return h * 60 + m;
  }

  private minsToHHMM(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private addMinsToHHMM(hhmm: string, mins: number): string {
    return this.minsToHHMM(this.hhmmToMins(hhmm) + mins);
  }

  private utcToLocalHHMM(utcDate: Date, timezone: string): string {
    return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm');
  }

  private toUTCIso(date: string, time: string, timezone: string): string {
    return DateTime.fromISO(`${date}T${time}:00`, { zone: timezone }).toUTC().toISO()!;
  }

  /** Two HH:MM half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap when aStart < bEnd && bStart < aEnd. */
  private overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return aStart < bEnd && bStart < aEnd;
  }
}
