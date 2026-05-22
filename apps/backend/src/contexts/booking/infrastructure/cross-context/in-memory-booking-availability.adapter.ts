import { Injectable } from '@nestjs/common';
import { BookedSlot } from '../../domain/booked-slot';
import { IBookingAvailabilityPort } from '../../application/ports/booking-availability.port';

// Returns no bookings until M07 wires the real BookingRepository.
@Injectable()
export class InMemoryBookingAvailabilityAdapter implements IBookingAvailabilityPort {
  async findApprovedByTenantAndDate(_tenantId: string, _date: string): Promise<BookedSlot[]> {
    return [];
  }

  async findApprovedByTenantAndDateRange(
    _tenantId: string,
    _from: string,
    _to: string,
  ): Promise<BookedSlot[]> {
    return [];
  }
}
