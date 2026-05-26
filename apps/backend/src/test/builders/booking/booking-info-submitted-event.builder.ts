import { BookingInfoSubmitted } from '../../../contexts/booking/domain/events/booking-info-submitted.event';

export class BookingInfoSubmittedEventBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private readonly correlationId = 'corr-info-sub-1';
  private bookingId = 'dddddddd-0004-4000-8000-000000000001';
  private customerId: string | null = null;
  private submittedByEmail = 'joao@example.com';
  private infoPayload: Record<string, unknown> = {
    notes: 'Aqui estão as fotos do veículo conforme solicitado',
  };
  private readonly photoUrls: string[] = [];

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withBookingId(bookingId: string): this {
    this.bookingId = bookingId;
    return this;
  }

  withCustomerId(customerId: string | null): this {
    this.customerId = customerId;
    return this;
  }

  withSubmittedByEmail(email: string): this {
    this.submittedByEmail = email;
    return this;
  }

  withInfoPayload(payload: Record<string, unknown>): this {
    this.infoPayload = payload;
    return this;
  }

  build(): BookingInfoSubmitted {
    return new BookingInfoSubmitted(this.tenantId, this.correlationId, {
      bookingId: this.bookingId,
      customerId: this.customerId,
      submittedByEmail: this.submittedByEmail,
      infoPayload: this.infoPayload,
      photoUrls: this.photoUrls,
    });
  }
}
