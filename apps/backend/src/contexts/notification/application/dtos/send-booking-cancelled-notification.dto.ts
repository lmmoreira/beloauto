export interface SendBookingCancelledNotificationDto {
  tenantId: string;
  eventId: string;
  correlationId: string;
  guestEmail: string;
  guestName: string;
  cancelledBy: string;
  isBusiness: boolean;
  reason: string | null;
  scheduledAt: string;
  lineSummary: Array<{
    serviceNameAtBooking: string;
    priceAtBooking: { amount: string; currency: string };
  }>;
  totalPrice: { amount: string; currency: string };
}
