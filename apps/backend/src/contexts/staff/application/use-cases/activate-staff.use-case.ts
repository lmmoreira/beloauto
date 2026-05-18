import { Inject, Injectable } from '@nestjs/common';
import {
  StaffAlreadyActiveError,
  StaffEmailMismatchError,
  StaffNotFoundError,
} from '../../domain/errors/staff-domain.error';
import { StaffRole } from '../../domain/staff.aggregate';
import { IStaffRepository, STAFF_REPOSITORY } from '../ports/staff-repository.port';

export interface ActivateStaffDto {
  staffId: string;
  tenantId: string;
  googleOAuthId: string;
  email: string;
}

export interface ActivateStaffResult {
  staffId: string;
  tenantId: string;
  role: StaffRole;
  isActive: true;
}

@Injectable()
export class ActivateStaffUseCase {
  constructor(@Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository) {}

  async execute(dto: ActivateStaffDto): Promise<ActivateStaffResult> {
    const staff = await this.staffRepo.findById(dto.staffId, dto.tenantId);
    if (!staff) throw new StaffNotFoundError(dto.staffId);
    if (staff.isActive) throw new StaffAlreadyActiveError(dto.staffId);
    if (staff.email.address !== dto.email) throw new StaffEmailMismatchError();

    staff.activate(dto.googleOAuthId);
    await this.staffRepo.save(staff);

    return { staffId: staff.id, tenantId: staff.tenantId, role: staff.role, isActive: true };
  }
}
