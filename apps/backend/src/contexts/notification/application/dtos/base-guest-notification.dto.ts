import { BaseNotificationDto } from './base-notification.dto';

export interface BaseGuestNotificationDto extends BaseNotificationDto {
  guestEmail: string;
  guestName: string;
}
