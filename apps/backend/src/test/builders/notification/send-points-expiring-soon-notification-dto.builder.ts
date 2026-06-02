import { SendPointsExpiringSoonNotificationDto } from '../../../contexts/notification/application/dtos/send-points-expiring-soon-notification.dto';

export class SendPointsExpiringSoonNotificationDtoBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000001602';
  private eventId = 'eeeeeeee-0000-4000-8000-000000001602';
  private readonly correlationId = 'corr-0000-4000-8000-000000001602';
  private customerId = 'cccccccc-0000-4000-8000-000000001602';
  private pointsExpiringSoon = 20;
  private earliestExpiresAt = '2026-06-09T00:00:00.000Z';

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withEventId(eventId: string): this {
    this.eventId = eventId;
    return this;
  }

  withCustomerId(customerId: string): this {
    this.customerId = customerId;
    return this;
  }

  withPointsExpiringSoon(points: number): this {
    this.pointsExpiringSoon = points;
    return this;
  }

  withEarliestExpiresAt(date: string): this {
    this.earliestExpiresAt = date;
    return this;
  }

  build(): SendPointsExpiringSoonNotificationDto {
    return {
      tenantId: this.tenantId,
      eventId: this.eventId,
      correlationId: this.correlationId,
      customerId: this.customerId,
      pointsExpiringSoon: this.pointsExpiringSoon,
      earliestExpiresAt: this.earliestExpiresAt,
    };
  }
}
