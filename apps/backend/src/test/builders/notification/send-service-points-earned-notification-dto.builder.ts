import {
  SendServicePointsEarnedNotificationDto,
  ServicePointsEarnedLineDto,
} from '../../../contexts/notification/application/dtos/send-service-points-earned-notification.dto';

export class SendServicePointsEarnedNotificationDtoBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private eventId = 'eeeeeeee-0000-4000-8000-000000000001';
  private readonly correlationId = 'corr-0000-4000-8000-000000000001';
  private customerId = 'cccccccc-0000-4000-8000-000000000001';
  private readonly bookingId = 'bbbbbbbb-0000-4000-8000-000000000001';
  private totalPointsEarned = 15;
  private readonly earnedAt = '2026-06-01T10:00:00.000Z';
  private currentBalance = 15;
  private lines: ServicePointsEarnedLineDto[] = [
    {
      entryId: 'e1',
      serviceId: 'ssssssss-0000-4000-8000-000000000001',
      pointsEarned: 10,
      expiresAt: '2026-11-28T10:00:00.000Z',
    },
    {
      entryId: 'e2',
      serviceId: 'ssssssss-0000-4000-8000-000000000002',
      pointsEarned: 5,
      expiresAt: '2026-11-28T10:00:00.000Z',
    },
  ];

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

  withTotalPointsEarned(totalPointsEarned: number): this {
    this.totalPointsEarned = totalPointsEarned;
    return this;
  }

  withCurrentBalance(currentBalance: number): this {
    this.currentBalance = currentBalance;
    return this;
  }

  withLines(lines: ServicePointsEarnedLineDto[]): this {
    this.lines = lines;
    return this;
  }

  build(): SendServicePointsEarnedNotificationDto {
    return {
      tenantId: this.tenantId,
      eventId: this.eventId,
      correlationId: this.correlationId,
      customerId: this.customerId,
      bookingId: this.bookingId,
      totalPointsEarned: this.totalPointsEarned,
      earnedAt: this.earnedAt,
      lines: this.lines,
      currentBalance: this.currentBalance,
    };
  }
}
