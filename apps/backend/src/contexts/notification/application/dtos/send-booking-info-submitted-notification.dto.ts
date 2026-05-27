export interface SendBookingInfoSubmittedNotificationDto {
  tenantId: string;
  eventId: string;
  correlationId: string;
  bookingId: string;
  submittedByEmail: string;
  infoPayload: Record<string, unknown>;
}
