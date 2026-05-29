import { SendStaffInvitationDto } from '../../../contexts/notification/application/dtos/send-staff-invitation.dto';

export class SendStaffInvitationDtoBuilder {
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private eventId = 'cccccccc-0000-4000-8000-000000000001';
  private readonly correlationId = 'corr-1';
  private staffId = 'bbbbbbbb-0000-4000-8000-000000000001';

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withEventId(eventId: string): this {
    this.eventId = eventId;
    return this;
  }

  withStaffId(staffId: string): this {
    this.staffId = staffId;
    return this;
  }

  build(): SendStaffInvitationDto {
    return {
      tenantId: this.tenantId,
      eventId: this.eventId,
      correlationId: this.correlationId,
      staffId: this.staffId,
    };
  }
}
