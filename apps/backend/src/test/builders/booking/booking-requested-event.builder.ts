import {
  AddressEventPayload,
  BookingLineEventPayload,
  BookingRequested,
} from '../../../contexts/booking/domain/events/booking-requested.event';

export class BookingRequestedEventBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private correlationId = 'corr-1';
  private bookingId = 'dddddddd-0000-4000-8000-000000000001';
  private type: 'GUEST' | 'CUSTOMER' = 'GUEST';
  private customerId: string | null = null;
  private guestEmail = 'joao@example.com';
  private guestName = 'João Silva';
  private guestPhone = '+5531999999999';
  private guestAddress: AddressEventPayload | null = null;
  private scheduledAt = '2026-06-15T13:00:00.000Z';
  private totalDurationMins = 60;
  private totalPrice = { amount: '150.00', currency: 'BRL' };
  private requiresPickup = false;
  private pickupAddress: AddressEventPayload | null = null;
  private lines: BookingLineEventPayload[] = [
    {
      lineId: 'eeeeeeee-0000-4000-8000-000000000001',
      serviceId: 'ffffffff-0000-4000-8000-000000000001',
      serviceNameAtBooking: 'Lavagem Completa',
      priceAtBooking: { amount: '150.00', currency: 'BRL' },
      durationMinsAtBooking: 60,
      pointsValueAtBooking: 1,
      requiresPickupAddressAtBooking: false,
    },
  ];
  private beforeServicePhotoUrls: string[] = [];

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }

  withGuestEmail(guestEmail: string): this {
    this.guestEmail = guestEmail;
    return this;
  }

  withGuestName(guestName: string): this {
    this.guestName = guestName;
    return this;
  }

  withScheduledAt(scheduledAt: string): this {
    this.scheduledAt = scheduledAt;
    return this;
  }

  withTotalPrice(totalPrice: { amount: string; currency: string }): this {
    this.totalPrice = totalPrice;
    return this;
  }

  withLines(lines: BookingLineEventPayload[]): this {
    this.lines = lines;
    return this;
  }

  withPickupAddress(pickupAddress: AddressEventPayload | null): this {
    this.pickupAddress = pickupAddress;
    return this;
  }

  build(): BookingRequested {
    return new BookingRequested(this.tenantId, this.correlationId, {
      bookingId: this.bookingId,
      type: this.type,
      customerId: this.customerId,
      guestEmail: this.guestEmail,
      guestName: this.guestName,
      guestPhone: this.guestPhone,
      guestAddress: this.guestAddress,
      scheduledAt: this.scheduledAt,
      totalDurationMins: this.totalDurationMins,
      totalPrice: this.totalPrice,
      requiresPickup: this.requiresPickup,
      pickupAddress: this.pickupAddress,
      lines: this.lines,
      beforeServicePhotoUrls: this.beforeServicePhotoUrls,
    });
  }
}
