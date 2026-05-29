import { BaseNotificationDto } from './base-notification.dto';

export interface SendServicePointsEarnedNotificationDto extends BaseNotificationDto {
  customerId: string;
  serviceId: string;
  pointsEarned: number;
  earnedAt: string;
  expiresAt: string;
  currentBalance: number;
}
