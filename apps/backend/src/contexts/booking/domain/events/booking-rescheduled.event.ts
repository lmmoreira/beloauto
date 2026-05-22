import { DomainEvent } from '../../../../shared/domain/domain-event';

interface BookingRescheduledData extends Record<string, unknown> {
  bookingId: string;
  customerId: string | null;
  guestEmail: string;
  guestName: string;
  newSlot: { startTime: string; endTime: string };
  previousSlot: { startTime: string; endTime: string };
  rescheduledBy: string;
  adminNotes: string | null;
}

export class BookingRescheduled extends DomainEvent<BookingRescheduledData> {
  readonly eventName = 'BookingRescheduled';
  readonly eventVersion = 1;
  readonly data: BookingRescheduledData;

  constructor(tenantId: string, correlationId: string, data: BookingRescheduledData) {
    super(tenantId, correlationId);
    this.data = data;
  }
}
