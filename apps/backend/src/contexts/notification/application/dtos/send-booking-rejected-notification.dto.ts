export interface SendBookingRejectedNotificationDto {
  tenantId: string;
  eventId: string;
  correlationId: string;
  guestEmail: string;
  guestName: string;
  reason: string;
}
