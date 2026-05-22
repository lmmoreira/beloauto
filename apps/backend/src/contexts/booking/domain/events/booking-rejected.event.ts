import { DomainEvent } from '../../../../shared/domain/domain-event';

interface BookingRejectedData extends Record<string, unknown> {
  bookingId: string;
  customerId: string | null;
  guestEmail: string;
  guestName: string;
  reason: string;
  rejectedBy: string;
}

export class BookingRejected extends DomainEvent<BookingRejectedData> {
  readonly eventName = 'BookingRejected';
  readonly eventVersion = 1;
  readonly data: BookingRejectedData;

  constructor(tenantId: string, correlationId: string, data: BookingRejectedData) {
    super(tenantId, correlationId);
    this.data = data;
  }
}
