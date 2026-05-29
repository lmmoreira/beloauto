import { ServicePointsEarned } from '../../../contexts/loyalty/domain/events/service-points-earned.event';

export class ServicePointsEarnedEventBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private correlationId = 'corr-points-1';
  private readonly entryId = 'eeeeeeee-0001-4000-8000-000000000001';
  private customerId = 'cccccccc-0001-4000-8000-000000000001';
  private readonly bookingId = 'bbbbbbbb-0001-4000-8000-000000000001';
  private readonly bookingLineId = 'bbbbbbbb-0002-4000-8000-000000000001';
  private serviceId = 'ssssssss-0001-4000-8000-000000000001';
  private pointsEarned = 10;
  private readonly earnedAt = '2026-06-01T10:00:00.000Z';
  private readonly expiresAt = '2026-11-28T10:00:00.000Z';
  private currentBalance = 10;

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

  withServiceId(serviceId: string): this {
    this.serviceId = serviceId;
    return this;
  }

  withPointsEarned(points: number): this {
    this.pointsEarned = points;
    return this;
  }

  withCurrentBalance(balance: number): this {
    this.currentBalance = balance;
    return this;
  }

  build(): ServicePointsEarned {
    return new ServicePointsEarned(this.tenantId, this.correlationId, {
      entryId: this.entryId,
      customerId: this.customerId,
      bookingId: this.bookingId,
      bookingLineId: this.bookingLineId,
      serviceId: this.serviceId,
      pointsEarned: this.pointsEarned,
      earnedAt: this.earnedAt,
      expiresAt: this.expiresAt,
      currentBalance: this.currentBalance,
    });
  }
}
