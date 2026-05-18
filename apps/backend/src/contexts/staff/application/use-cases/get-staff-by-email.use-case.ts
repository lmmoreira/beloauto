import { Inject, Injectable } from '@nestjs/common';
import { StaffRole } from '../../domain/staff.aggregate';
import { IStaffRepository, STAFF_REPOSITORY } from '../ports/staff-repository.port';

export interface StaffByEmailInfo {
  staffId: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
}

@Injectable()
export class GetStaffByEmailUseCase {
  constructor(@Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository) {}

  async execute(email: string, tenantId: string): Promise<StaffByEmailInfo | null> {
    const staff = await this.staffRepo.findByTenantAndEmail(tenantId, email);
    if (!staff) return null;
    return {
      staffId: staff.id,
      email: staff.email.address,
      role: staff.role,
      isActive: staff.isActive,
    };
  }
}
