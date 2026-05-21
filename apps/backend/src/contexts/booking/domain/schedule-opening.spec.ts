import { ScheduleOpening } from './schedule-opening.aggregate';
import {
  BookingDomainError,
  DayAlreadyOpenInSettingsError,
  OpeningDateInPastError,
  ScheduleOpeningAlreadyExistsError,
  ScheduleOpeningNotFoundError,
} from './errors/booking-domain.error';
import { TimeOfDay } from '../../../shared/value-objects/time-of-day.vo';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const STAFF_ID = '00000000-0000-7000-8000-000000000002';

function futureDate(daysAhead = 7): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function pastDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

describe('ScheduleOpening', () => {
  describe('open() factory', () => {
    it('creates a valid opening with all fields', () => {
      const date = futureDate();
      const opening = ScheduleOpening.open(
        TENANT_ID,
        date,
        '09:00',
        '14:00',
        STAFF_ID,
        'Special event',
      );

      expect(opening.id).toBeDefined();
      expect(opening.tenantId).toBe(TENANT_ID);
      expect(opening.date).toBe(date);
      expect(opening.startTime).toBeInstanceOf(TimeOfDay);
      expect(opening.startTime.value).toBe('09:00');
      expect(opening.endTime).toBeInstanceOf(TimeOfDay);
      expect(opening.endTime.value).toBe('14:00');
      expect(opening.notes).toBe('Special event');
      expect(opening.createdBy).toBe(STAFF_ID);
      expect(opening.createdAt).toBeInstanceOf(Date);
    });

    it('creates a valid opening without notes', () => {
      const opening = ScheduleOpening.open(TENANT_ID, futureDate(), '08:00', '18:00', STAFF_ID);
      expect(opening.notes).toBeNull();
    });

    it('trims whitespace from notes', () => {
      const opening = ScheduleOpening.open(
        TENANT_ID,
        futureDate(),
        '09:00',
        '17:00',
        STAFF_ID,
        '  trimmed  ',
      );
      expect(opening.notes).toBe('trimmed');
    });

    it('throws OpeningDateInPastError for a past date', () => {
      expect(() => ScheduleOpening.open(TENANT_ID, pastDate(), '09:00', '14:00', STAFF_ID)).toThrow(
        OpeningDateInPastError,
      );
    });

    it('throws when endTime equals startTime', () => {
      expect(() =>
        ScheduleOpening.open(TENANT_ID, futureDate(), '10:00', '10:00', STAFF_ID),
      ).toThrow(BookingDomainError);
    });

    it('throws when endTime is before startTime', () => {
      expect(() =>
        ScheduleOpening.open(TENANT_ID, futureDate(), '14:00', '09:00', STAFF_ID),
      ).toThrow(BookingDomainError);
    });

    it('throws for invalid startTime format', () => {
      expect(() =>
        ScheduleOpening.open(TENANT_ID, futureDate(), '9:00', '14:00', STAFF_ID),
      ).toThrow(BookingDomainError);
    });

    it('throws for invalid endTime format', () => {
      expect(() =>
        ScheduleOpening.open(TENANT_ID, futureDate(), '09:00', '25:00', STAFF_ID),
      ).toThrow(BookingDomainError);
    });

    it('throws for missing tenantId', () => {
      expect(() => ScheduleOpening.open('', futureDate(), '09:00', '14:00', STAFF_ID)).toThrow(
        BookingDomainError,
      );
    });

    it('throws for missing createdBy', () => {
      expect(() => ScheduleOpening.open(TENANT_ID, futureDate(), '09:00', '14:00', '')).toThrow(
        BookingDomainError,
      );
    });
  });

  describe('domain errors', () => {
    it('OpeningDateInPastError is instanceof BookingDomainError', () => {
      const err = new OpeningDateInPastError();
      expect(err).toBeInstanceOf(BookingDomainError);
      expect(err.name).toBe('OpeningDateInPastError');
    });

    it('DayAlreadyOpenInSettingsError carries the date in its message', () => {
      const err = new DayAlreadyOpenInSettingsError('2026-12-28');
      expect(err).toBeInstanceOf(BookingDomainError);
      expect(err.message).toContain('2026-12-28');
      expect(err.name).toBe('DayAlreadyOpenInSettingsError');
    });

    it('ScheduleOpeningAlreadyExistsError carries the date in its message', () => {
      const err = new ScheduleOpeningAlreadyExistsError('2026-12-28');
      expect(err).toBeInstanceOf(BookingDomainError);
      expect(err.message).toContain('2026-12-28');
      expect(err.name).toBe('ScheduleOpeningAlreadyExistsError');
    });

    it('ScheduleOpeningNotFoundError carries the id in its message', () => {
      const err = new ScheduleOpeningNotFoundError('some-id');
      expect(err).toBeInstanceOf(BookingDomainError);
      expect(err.message).toContain('some-id');
      expect(err.name).toBe('ScheduleOpeningNotFoundError');
    });
  });

  describe('reconstitute()', () => {
    it('skips validation and restores all props from DB', () => {
      const past = '2020-01-01';
      const opening = ScheduleOpening.reconstitute({
        id: '00000000-0000-7000-8000-000000000099',
        tenantId: TENANT_ID,
        date: past,
        startTime: TimeOfDay.create('08:00'),
        endTime: TimeOfDay.create('12:00'),
        notes: null,
        createdBy: STAFF_ID,
        createdAt: new Date('2020-01-01T00:00:00Z'),
      });

      expect(opening.date).toBe(past);
      expect(opening.startTime.value).toBe('08:00');
      expect(opening.endTime.value).toBe('12:00');
    });
  });
});
