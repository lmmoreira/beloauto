import { Inject, Injectable } from '@nestjs/common';
import { StaffRole } from '../../domain/staff.aggregate';
import { IStaffRepository, STAFF_REPOSITORY } from '../ports/staff-repository.port';

export interface StaffAuthInfo {
  staffId: string;
  tenantId: string;
  role: StaffRole;
  isActive: boolean;
}

@Injectable()
export class GetStaffByOAuthIdUseCase {
  constructor(@Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository) {}

  async execute(googleOAuthId: string): Promise<StaffAuthInfo | null> {
    const staff = await this.staffRepo.findByGoogleOAuthId(googleOAuthId);
    if (!staff) return null;
    return {
      staffId: staff.id,
      tenantId: staff.tenantId,
      role: staff.role,
      isActive: staff.isActive,
    };
  }
}
