import { Injectable } from '@nestjs/common';
import { GetStaffByIdUseCase } from '../../../staff/application/use-cases/get-staff-by-id.use-case';
import {
  INotificationStaffPort,
  NotificationStaffInfo,
} from '../../application/ports/notification-staff.port';

@Injectable()
export class StaffInfoAdapter implements INotificationStaffPort {
  constructor(private readonly getStaffById: GetStaffByIdUseCase) {}

  async getStaffInfo(staffId: string, tenantId: string): Promise<NotificationStaffInfo | null> {
    try {
      const result = await this.getStaffById.execute(staffId, tenantId);
      return { id: result.id, email: result.email, name: result.name };
    } catch {
      return null;
    }
  }
}
