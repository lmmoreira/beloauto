export interface SendBookingInfoRequestedNotificationDto {
  tenantId: string;
  eventId: string;
  correlationId: string;
  bookingId: string;
  customerId: string | null;
  guestEmail: string;
  guestName: string;
  informationNeeded: string;
}
