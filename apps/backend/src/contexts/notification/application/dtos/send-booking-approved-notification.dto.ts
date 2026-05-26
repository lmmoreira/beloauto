export interface SendBookingApprovedNotificationDto {
  tenantId: string;
  eventId: string;
  correlationId: string;
  guestEmail: string;
  guestName: string;
  approvedSlot: { startTime: string; endTime: string };
  totalPrice: { amount: string; currency: string };
  lineSummary: Array<{
    serviceNameAtBooking: string;
    priceAtBooking: { amount: string; currency: string };
  }>;
}
