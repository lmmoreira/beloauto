import { BaseNotificationDto } from './base-notification.dto';

export interface SendStaffInvitationDto extends BaseNotificationDto {
  staffId: string;
}
