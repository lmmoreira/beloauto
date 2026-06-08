export const PLATFORM_BOOKING_PORT = Symbol('IPlatformBookingPort');

export interface BookingLookupSummary {
  id: string;
  customerId: string | null;
  beforeServicePhotoUrls: string[];
  afterServicePhotoUrls: string[];
}

export interface IPlatformBookingPort {
  findById(bookingId: string, tenantId: string): Promise<BookingLookupSummary | null>;
}
