import { BookingInfoRequested } from '../../../contexts/booking/domain/events/booking-info-requested.event';

export class BookingInfoRequestedEventBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private readonly correlationId = 'corr-info-req-1';
  private bookingId = 'dddddddd-0003-4000-8000-000000000001';
  private customerId: string | null = null;
  private guestEmail = 'joao@example.com';
  private readonly guestName = 'João Silva';
  private readonly informationNeeded = 'Por favor envie fotos melhores do veículo';
  private readonly requestedBy = 'staffid-0000-4000-8000-000000000001';

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

  withGuestEmail(guestEmail: string): this {
    this.guestEmail = guestEmail;
    return this;
  }

  build(): BookingInfoRequested {
    return new BookingInfoRequested(this.tenantId, this.correlationId, {
      bookingId: this.bookingId,
      customerId: this.customerId,
      guestEmail: this.guestEmail,
      guestName: this.guestName,
      informationNeeded: this.informationNeeded,
      requestedBy: this.requestedBy,
    });
  }
}
