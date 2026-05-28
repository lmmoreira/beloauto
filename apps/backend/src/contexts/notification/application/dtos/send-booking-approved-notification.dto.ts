import { BaseGuestNotificationDto } from './base-guest-notification.dto';

export interface SendBookingApprovedNotificationDto extends BaseGuestNotificationDto {
  approvedSlot: { startTime: string; endTime: string };
  totalPrice: { amount: string; currency: string };
  lineSummary: Array<{
    serviceNameAtBooking: string;
    priceAtBooking: { amount: string; currency: string };
  }>;
}
