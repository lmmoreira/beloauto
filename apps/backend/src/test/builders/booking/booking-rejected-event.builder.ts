import { BookingRejected } from '../../../contexts/booking/domain/events/booking-rejected.event';

export class BookingRejectedEventBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private readonly correlationId = 'corr-rejected-1';
  private readonly bookingId = 'dddddddd-0002-4000-8000-000000000001';
  private customerId: string | null = null;
  private guestEmail = 'joao@example.com';
  private readonly guestName = 'João Silva';
  private reason = 'Horário indisponível para os serviços selecionados';
  private readonly rejectedBy = 'staffid-0000-4000-8000-000000000001';

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withGuestEmail(guestEmail: string): this {
    this.guestEmail = guestEmail;
    return this;
  }

  withCustomerId(customerId: string | null): this {
    this.customerId = customerId;
    return this;
  }

  withReason(reason: string): this {
    this.reason = reason;
    return this;
  }

  build(): BookingRejected {
    return new BookingRejected(this.tenantId, this.correlationId, {
      bookingId: this.bookingId,
      customerId: this.customerId,
      guestEmail: this.guestEmail,
      guestName: this.guestName,
      reason: this.reason,
      rejectedBy: this.rejectedBy,
    });
  }
}
