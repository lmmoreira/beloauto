import { BaseGuestNotificationDto } from './base-guest-notification.dto';

export interface SendBookingRescheduledNotificationDto extends BaseGuestNotificationDto {
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
