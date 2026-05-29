import { SendBookingInfoSubmittedNotificationDto } from '../../../contexts/notification/application/dtos/send-booking-info-submitted-notification.dto';

export class SendBookingInfoSubmittedNotificationDtoBuilder {
  private tenantId = 'aaaaaaaa-0004-4000-8000-000000000001';
  private eventId = 'cccccccc-0004-4000-8000-000000000001';
  private readonly correlationId = 'corr-info-sub-1';
  private readonly bookingId = 'bbbbbbbb-0004-4000-8000-000000000001';
  private readonly submittedByEmail = 'joao@example.com';
  private readonly infoPayload: Record<string, unknown> = {
    notes: 'Aqui estão as fotos do veículo conforme solicitado',
  };

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withEventId(eventId: string): this {
    this.eventId = eventId;
    return this;
  }

  build(): SendBookingInfoSubmittedNotificationDto {
    return {
      tenantId: this.tenantId,
      eventId: this.eventId,
      correlationId: this.correlationId,
      bookingId: this.bookingId,
      submittedByEmail: this.submittedByEmail,
      infoPayload: this.infoPayload,
    };
  }
}
