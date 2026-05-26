import { InMemoryBookingAvailabilityPort } from '../../../../test/infrastructure/in-memory-booking-availability';
import { InMemoryScheduleTenantSettingsPort } from '../../../../test/infrastructure/in-memory-schedule-tenant-settings';
import { futureDate } from '../../../../test/utils/date-helpers';
import { BookingSlotUnavailableError } from '../../domain/errors/booking-domain.error';
import { BookingSlotConflictService } from './booking-slot-conflict.service';

const TENANT_ID = '10000000-0000-4000-8000-000000000300';
const scheduledAt = new Date(`${futureDate(5)}T13:00:00.000Z`);

describe('BookingSlotConflictService', () => {
  let availabilityPort: InMemoryBookingAvailabilityPort;
  let service: BookingSlotConflictService;

  beforeEach(() => {
    availabilityPort = new InMemoryBookingAvailabilityPort();
    service = new BookingSlotConflictService(
      availabilityPort,
      new InMemoryScheduleTenantSettingsPort(),
    );
  });

  it('resolves when no existing slots', async () => {
    await expect(service.assertSlotFree(TENANT_ID, scheduledAt, 30)).resolves.toBeUndefined();
  });

  it('throws BookingSlotUnavailableError when slot exactly overlaps', async () => {
    availabilityPort.setSlots([{ scheduledAt, totalDurationMins: 60 }]);
    await expect(service.assertSlotFree(TENANT_ID, scheduledAt, 30)).rejects.toThrow(
      BookingSlotUnavailableError,
    );
  });

  it('throws when new booking starts inside an existing slot', async () => {
    const before = new Date(scheduledAt.getTime() - 15 * 60_000);
    availabilityPort.setSlots([{ scheduledAt: before, totalDurationMins: 60 }]);
    await expect(service.assertSlotFree(TENANT_ID, scheduledAt, 30)).rejects.toThrow(
      BookingSlotUnavailableError,
    );
  });

  it('allows booking when adjacent slot comes after (non-overlapping)', async () => {
    const after = new Date(scheduledAt.getTime() + 30 * 60_000);
    availabilityPort.setSlots([{ scheduledAt: after, totalDurationMins: 30 }]);
    await expect(service.assertSlotFree(TENANT_ID, scheduledAt, 30)).resolves.toBeUndefined();
  });

  it('allows booking when adjacent slot comes before (non-overlapping)', async () => {
    const before = new Date(scheduledAt.getTime() - 30 * 60_000);
    availabilityPort.setSlots([{ scheduledAt: before, totalDurationMins: 30 }]);
    await expect(service.assertSlotFree(TENANT_ID, scheduledAt, 30)).resolves.toBeUndefined();
  });
});
