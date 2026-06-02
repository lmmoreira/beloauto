export interface SendPointsExpiringSoonNotificationDto {
  tenantId: string;
  eventId: string;
  correlationId: string;
  customerId: string;
  pointsExpiringSoon: number;
  earliestExpiresAt: string;
}
