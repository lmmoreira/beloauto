import {
  ServicePointsEarned,
  ServicePointsEarnedLine,
} from '../../../contexts/loyalty/domain/events/service-points-earned.event';

export class ServicePointsEarnedEventBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private correlationId = 'corr-points-1';
  private customerId = 'cccccccc-0001-4000-8000-000000000001';
  private readonly bookingId = 'bbbbbbbb-0001-4000-8000-000000000001';
  private totalPointsEarned = 10;
  private readonly earnedAt = '2026-06-01T10:00:00.000Z';
  private currentBalance = 10;
  private lines: ServicePointsEarnedLine[] = [
    {
      entryId: 'eeeeeeee-0001-4000-8000-000000000001',
      serviceId: 'ssssssss-0001-4000-8000-000000000001',
      pointsEarned: 10,
      expiresAt: '2026-11-28T10:00:00.000Z',
    },
  ];

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }

  withCustomerId(customerId: string): this {
    this.customerId = customerId;
    return this;
  }

  withTotalPointsEarned(points: number): this {
    this.totalPointsEarned = points;
    return this;
  }

  withCurrentBalance(balance: number): this {
    this.currentBalance = balance;
    return this;
  }

  withLines(lines: ServicePointsEarnedLine[]): this {
    this.lines = lines;
    return this;
  }

  build(): ServicePointsEarned {
    return new ServicePointsEarned(this.tenantId, this.correlationId, {
      customerId: this.customerId,
      bookingId: this.bookingId,
      totalPointsEarned: this.totalPointsEarned,
      earnedAt: this.earnedAt,
      lines: this.lines,
      currentBalance: this.currentBalance,
    });
  }
}
