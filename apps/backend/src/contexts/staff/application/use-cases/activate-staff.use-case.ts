import { Inject, Injectable } from '@nestjs/common';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../shared/ports/transaction-manager.port';
import { ActivateStaffDto } from '../dtos/activate-staff.dto';
import {
  StaffAlreadyActiveError,
  StaffEmailMismatchError,
  StaffNotFoundError,
} from '../../domain/errors/staff-domain.error';
import { StaffRole } from '../../domain/staff.aggregate';
import { IStaffRepository, STAFF_REPOSITORY } from '../ports/staff-repository.port';

export interface ActivateStaffUseCaseResult {
  staffId: string;
  tenantId: string;
  role: StaffRole;
  isActive: true;
}

@Injectable()
export class ActivateStaffUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
  ) {}

  async execute(staffId: string, dto: ActivateStaffDto): Promise<ActivateStaffUseCaseResult> {
    return this.txManager.run(async () => {
      const staff = await this.staffRepo.findById(staffId, dto.tenantId);
      if (!staff) throw new StaffNotFoundError(staffId);
      if (staff.isActive) throw new StaffAlreadyActiveError(staffId);
      if (staff.email.address !== dto.email.toLowerCase().trim())
        throw new StaffEmailMismatchError();

      staff.activate(dto.googleOAuthId, dto.name);
      await this.staffRepo.save(staff);

      return { staffId: staff.id, tenantId: staff.tenantId, role: staff.role, isActive: true };
    });
  }
}
