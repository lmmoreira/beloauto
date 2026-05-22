import { DomainEvent } from '../../../../shared/domain/domain-event';

interface BookingCancelledData extends Record<string, unknown> {
  bookingId: string;
  customerId: string | null;
  guestEmail: string;
  guestName: string;
  cancelledBy: string;
  isBusiness: boolean;
  reason: string | null;
}

export class BookingCancelled extends DomainEvent<BookingCancelledData> {
  readonly eventName = 'BookingCancelled';
  readonly eventVersion = 1;
  readonly data: BookingCancelledData;

  constructor(tenantId: string, correlationId: string, data: BookingCancelledData) {
    super(tenantId, correlationId);
    this.data = data;
  }
}
