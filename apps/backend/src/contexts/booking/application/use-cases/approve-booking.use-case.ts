import { Inject, Injectable } from '@nestjs/common';
import { IEventBus, EVENT_BUS } from '../../../../shared/ports/event-bus.port';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../shared/ports/transaction-manager.port';
import { TenantContext } from '../../../../shared/tenant/tenant-context';
import {
  BookingNotFoundError,
  BookingSlotUnavailableError,
  InvalidBookingTransitionError,
} from '../../domain/errors/booking-domain.error';
import { BookingStatus } from '../../domain/booking.aggregate';
import {
  IBookingAvailabilityPort,
  BOOKING_AVAILABILITY_PORT,
} from '../ports/booking-availability.port';
import { IBookingRepository, BOOKING_REPOSITORY } from '../ports/booking-repository.port';
import { ApproveBookingDto, ApproveBookingUseCaseResult } from '../dtos/approve-booking.dto';

@Injectable()
export class ApproveBookingUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    @Inject(BOOKING_REPOSITORY) private readonly bookingRepo: IBookingRepository,
    @Inject(BOOKING_AVAILABILITY_PORT) private readonly availabilityPort: IBookingAvailabilityPort,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async execute(dto: ApproveBookingDto): Promise<ApproveBookingUseCaseResult> {
    const tenantId = this.tenantContext.tenantId;
    const staffId = this.tenantContext.actorId!;
    const correlationId = this.tenantContext.correlationId;

    const booking = await this.bookingRepo.findById(dto.bookingId, tenantId);
    if (!booking) throw new BookingNotFoundError(dto.bookingId);

    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.INFO_REQUESTED
    ) {
      throw new InvalidBookingTransitionError(booking.status, BookingStatus.APPROVED);
    }

    await this.assertSlotFree(tenantId, booking.scheduledAt, booking.totalDurationMins);

    booking.approve(staffId, correlationId);

    await this.txManager.run(async () => {
      await this.bookingRepo.save(booking);
    });

    for (const event of booking.clearDomainEvents()) {
      await this.eventBus.publish(event);
    }

    return {
      bookingId: booking.id,
      status: booking.status,
      approvedAt: booking.approvedAt!.toISOString(),
    };
  }

  private async assertSlotFree(
    tenantId: string,
    scheduledAt: Date,
    totalDurationMins: number,
  ): Promise<void> {
    const dateStr = scheduledAt.toISOString().slice(0, 10);
    const existingSlots = await this.availabilityPort.findApprovedByTenantAndDate(
      tenantId,
      dateStr,
    );

    const bookingStart = scheduledAt.getTime();
    const bookingEnd = bookingStart + totalDurationMins * 60_000;

    const hasConflict = existingSlots.some((slot) => {
      const slotStart = slot.scheduledAt.getTime();
      const slotEnd = slotStart + slot.totalDurationMins * 60_000;
      return slotStart < bookingEnd && bookingStart < slotEnd;
    });

    if (hasConflict) throw new BookingSlotUnavailableError();
  }
}
