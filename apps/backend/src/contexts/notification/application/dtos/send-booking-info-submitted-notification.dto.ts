import { BaseNotificationDto } from './base-notification.dto';

export interface SendBookingInfoSubmittedNotificationDto extends BaseNotificationDto {
  bookingId: string;
  submittedByEmail: string;
  infoPayload: Record<string, unknown>;
}
