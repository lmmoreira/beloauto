import { Inject, Injectable } from '@nestjs/common';
import { StaffNotFoundError } from '../../domain/errors/staff-domain.error';
import { StaffRole } from '../../domain/staff.aggregate';
import { IStaffRepository, STAFF_REPOSITORY } from '../ports/staff-repository.port';

export interface GetStaffByOAuthIdUseCaseResult {
  staffId: string;
  tenantId: string;
  role: StaffRole;
  isActive: boolean;
}

@Injectable()
export class GetStaffByOAuthIdUseCase {
  constructor(@Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository) {}

  async execute(googleOAuthId: string): Promise<GetStaffByOAuthIdUseCaseResult> {
    const staff = await this.staffRepo.findByGoogleOAuthId(googleOAuthId);
    if (!staff) throw new StaffNotFoundError(googleOAuthId);
    return {
      staffId: staff.id,
      tenantId: staff.tenantId,
      role: staff.role,
      isActive: staff.isActive,
    };
  }
}
