import { InMemoryBookingAvailabilityPort } from '../../../../test/infrastructure/in-memory-booking-availability';
import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryBookingRepository } from '../../../../test/repositories/booking/in-memory-booking.repository';
import { BookingBuilder } from '../../../../test/builders/booking/index';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { futureDate } from '../../../../test/utils/date-helpers';
import { BookingStatus } from '../../domain/booking.aggregate';
import {
  BookingNotFoundError,
  BookingSlotUnavailableError,
  InvalidBookingTransitionError,
} from '../../domain/errors/booking-domain.error';
import { ApproveBookingUseCase } from './approve-booking.use-case';

const TENANT_A = '10000000-0000-4000-8000-000000000201';
const TENANT_B = '10000000-0000-4000-8000-000000000202';
const STAFF_ID = '20000000-0000-4000-8000-000000000201';
const CORRELATION_ID = 'corr-approve-test';

const scheduledAt = new Date(`${futureDate(2)}T13:00:00.000Z`);

function makeUseCase(opts: {
  bookingRepo?: InMemoryBookingRepository;
  availabilityPort?: InMemoryBookingAvailabilityPort;
  tenantId?: string;
}): {
  useCase: ApproveBookingUseCase;
  bookingRepo: InMemoryBookingRepository;
  eventBus: InMemoryEventBus;
  availabilityPort: InMemoryBookingAvailabilityPort;
} {
  const bookingRepo = opts.bookingRepo ?? new InMemoryBookingRepository();
  const availabilityPort = opts.availabilityPort ?? new InMemoryBookingAvailabilityPort();
  const eventBus = new InMemoryEventBus();
  const ctx = new TenantContextBuilder()
    .withTenantId(opts.tenantId ?? TENANT_A)
    .withCorrelationId(CORRELATION_ID)
    .withActorId(STAFF_ID)
    .withActorRole('MANAGER')
    .build();
  const useCase = new ApproveBookingUseCase(
    ctx,
    bookingRepo,
    availabilityPort,
    new InMemoryTransactionManager(),
    eventBus,
  );
  return { useCase, bookingRepo, eventBus, availabilityPort };
}

describe('ApproveBookingUseCase', () => {
  describe('approve()', () => {
    let bookingRepo: InMemoryBookingRepository;
    let eventBus: InMemoryEventBus;
    let useCase: ApproveBookingUseCase;

    beforeEach(async () => {
      ({ useCase, bookingRepo, eventBus } = makeUseCase({}));
    });

    it('transitions PENDING → APPROVED and returns result', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .build();
      await bookingRepo.save(booking);

      const result = await useCase.execute({ bookingId: booking.id });

      expect(result.status).toBe(BookingStatus.APPROVED);
      expect(result.bookingId).toBe(booking.id);
      expect(result.approvedAt).toBeDefined();
    });

    it('transitions INFO_REQUESTED → APPROVED', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .withStatus(BookingStatus.INFO_REQUESTED)
        .build();
      await bookingRepo.save(booking);

      const result = await useCase.execute({ bookingId: booking.id });

      expect(result.status).toBe(BookingStatus.APPROVED);
    });

    it('persists the approved status to the repository', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .build();
      await bookingRepo.save(booking);

      await useCase.execute({ bookingId: booking.id });

      const saved = await bookingRepo.findById(booking.id, TENANT_A);
      expect(saved!.status).toBe(BookingStatus.APPROVED);
      expect(saved!.approvedBy).toBe(STAFF_ID);
      expect(saved!.approvedAt).not.toBeNull();
    });

    it('publishes BookingApproved event with serviceNameAtBooking in lineSummary', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .build();
      await bookingRepo.save(booking);

      await useCase.execute({ bookingId: booking.id });

      const events = eventBus.published;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('BookingApproved');
      const data = events[0].data as { lineSummary: { serviceNameAtBooking: string }[] };
      expect(data.lineSummary[0].serviceNameAtBooking).toBeDefined();
    });

    it('throws BookingNotFoundError when booking does not exist', async () => {
      await expect(
        useCase.execute({ bookingId: '00000000-0000-4000-8000-000000000000' }),
      ).rejects.toThrow(BookingNotFoundError);
    });

    it('throws InvalidBookingTransitionError when booking is COMPLETED', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .withStatus(BookingStatus.COMPLETED)
        .build();
      await bookingRepo.save(booking);

      await expect(useCase.execute({ bookingId: booking.id })).rejects.toThrow(
        InvalidBookingTransitionError,
      );
    });

    it('throws InvalidBookingTransitionError when booking is REJECTED', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .withStatus(BookingStatus.REJECTED)
        .build();
      await bookingRepo.save(booking);

      await expect(useCase.execute({ bookingId: booking.id })).rejects.toThrow(
        InvalidBookingTransitionError,
      );
    });

    it('throws InvalidBookingTransitionError when booking is CANCELLED', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .withStatus(BookingStatus.CANCELLED)
        .build();
      await bookingRepo.save(booking);

      await expect(useCase.execute({ bookingId: booking.id })).rejects.toThrow(
        InvalidBookingTransitionError,
      );
    });

    it('throws BookingSlotUnavailableError when slot overlaps an approved booking', async () => {
      const availabilityPort = new InMemoryBookingAvailabilityPort();
      availabilityPort.setSlots([{ scheduledAt, totalDurationMins: 60 }]);
      const { useCase: uc, bookingRepo: repo } = makeUseCase({ availabilityPort });

      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .build();
      await repo.save(booking);

      await expect(uc.execute({ bookingId: booking.id })).rejects.toThrow(
        BookingSlotUnavailableError,
      );
    });

    it('allows approval when existing slot is non-overlapping (adjacent)', async () => {
      const otherSlotAt = new Date(scheduledAt.getTime() + 30 * 60_000);
      const availabilityPort = new InMemoryBookingAvailabilityPort();
      availabilityPort.setSlots([{ scheduledAt: otherSlotAt, totalDurationMins: 30 }]);
      const { useCase: uc, bookingRepo: repo } = makeUseCase({ availabilityPort });

      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .build();
      await repo.save(booking);

      const result = await uc.execute({ bookingId: booking.id });
      expect(result.status).toBe(BookingStatus.APPROVED);
    });

    it('tenant isolation: cannot approve booking from another tenant', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_B)
        .withScheduledAt(scheduledAt)
        .build();
      await bookingRepo.save(booking);

      await expect(useCase.execute({ bookingId: booking.id })).rejects.toThrow(
        BookingNotFoundError,
      );
    });
  });
});
