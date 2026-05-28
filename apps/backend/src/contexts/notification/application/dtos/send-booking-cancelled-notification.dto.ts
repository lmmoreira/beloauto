import { BaseGuestNotificationDto } from './base-guest-notification.dto';

export interface SendBookingCancelledNotificationDto extends BaseGuestNotificationDto {
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
