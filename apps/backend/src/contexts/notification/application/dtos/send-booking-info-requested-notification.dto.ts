import { BaseGuestNotificationDto } from './base-guest-notification.dto';

export interface SendBookingInfoRequestedNotificationDto extends BaseGuestNotificationDto {
  bookingId: string;
  customerId: string | null;
  informationNeeded: string;
}
