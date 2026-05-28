import { BaseGuestNotificationDto } from './base-guest-notification.dto';

export interface SendBookingRejectedNotificationDto extends BaseGuestNotificationDto {
  reason: string;
}
