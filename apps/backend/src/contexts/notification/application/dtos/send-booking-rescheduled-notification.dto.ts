export interface SendBookingRescheduledNotificationDto {
  tenantId: string;
  eventId: string;
  correlationId: string;
  guestEmail: string;
  guestName: string;
  newSlot: { startTime: string; endTime: string };
  previousSlot: { startTime: string; endTime: string };
  rescheduledBy: string;
  adminNotes: string | null;
  lineSummary: Array<{
    serviceNameAtBooking: string;
    priceAtBooking: { amount: string; currency: string };
  }>;
  totalPrice: { amount: string; currency: string };
}
