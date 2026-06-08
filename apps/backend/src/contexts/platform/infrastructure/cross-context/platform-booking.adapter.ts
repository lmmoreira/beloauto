import { Injectable } from '@nestjs/common';
import { BookingQueryService } from '../../../booking/application/services/booking-query.service';
import {
  BookingLookupSummary,
  IPlatformBookingPort,
} from '../../application/ports/platform-booking.port';

@Injectable()
export class PlatformBookingAdapter implements IPlatformBookingPort {
  constructor(private readonly bookingQueryService: BookingQueryService) {}

  async findById(bookingId: string, tenantId: string): Promise<BookingLookupSummary | null> {
    try {
      const booking = await this.bookingQueryService.findById(bookingId, tenantId);
      if (!booking) return null;
      return {
        id: booking.id,
        customerId: booking.customerId,
        beforeServicePhotoUrls: booking.beforeServicePhotoUrls,
        afterServicePhotoUrls: booking.afterServicePhotoUrls,
      };
    } catch {
      return null;
    }
  }
}
