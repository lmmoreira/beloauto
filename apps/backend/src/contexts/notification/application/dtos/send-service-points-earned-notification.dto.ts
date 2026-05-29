import { BaseNotificationDto } from './base-notification.dto';

export interface ServicePointsEarnedLineDto {
  entryId: string;
  serviceId: string;
  pointsEarned: number;
  expiresAt: string;
}

export interface SendServicePointsEarnedNotificationDto extends BaseNotificationDto {
  customerId: string;
  bookingId: string;
  totalPointsEarned: number;
  earnedAt: string;
  lines: ServicePointsEarnedLineDto[];
  currentBalance: number;
}
