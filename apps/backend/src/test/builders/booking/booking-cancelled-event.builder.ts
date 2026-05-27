import { BookingCancelled } from '../../../contexts/booking/domain/events/booking-cancelled.event';

export class BookingCancelledEventBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private correlationId = 'corr-cancelled-1';
  private readonly bookingId = 'dddddddd-0002-4000-8000-000000000001';
  private customerId: string | null = null;
  private guestEmail = 'joao@example.com';
  private readonly guestName = 'João Silva';
  private readonly lineSummary = [
    {
      serviceId: 'ffffffff-0001-4000-8000-000000000001',
      serviceNameAtBooking: 'Lavagem Completa',
      priceAtBooking: { amount: '150.00', currency: 'BRL' },
    },
  ];
  private readonly totalPrice = { amount: '150.00', currency: 'BRL' };
  private cancelledBy = 'staffid-0000-4000-8000-000000000001';
  private isBusiness = true;
  private reason: string | null = null;
  private readonly scheduledAt = '2026-07-01T10:00:00.000Z';

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withIsBusiness(isBusiness: boolean): this {
    this.isBusiness = isBusiness;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }

  withReason(reason: string | null): this {
    this.reason = reason;
    return this;
  }

  withGuestEmail(guestEmail: string): this {
    this.guestEmail = guestEmail;
    return this;
  }

  withCancelledBy(cancelledBy: string): this {
    this.cancelledBy = cancelledBy;
    return this;
  }

  withCustomerId(customerId: string | null): this {
    this.customerId = customerId;
    return this;
  }

  build(): BookingCancelled {
    return new BookingCancelled(this.tenantId, this.correlationId, {
      bookingId: this.bookingId,
      customerId: this.customerId,
      guestEmail: this.guestEmail,
      guestName: this.guestName,
      cancelledBy: this.cancelledBy,
      isBusiness: this.isBusiness,
      reason: this.reason,
      scheduledAt: this.scheduledAt,
      lineSummary: this.lineSummary,
      totalPrice: this.totalPrice,
    });
  }
}
