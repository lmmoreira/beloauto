import { Inject, Injectable } from '@nestjs/common';
import { StaffNotFoundError } from '../../domain/errors/staff-domain.error';
import { IStaffRepository, STAFF_REPOSITORY } from '../ports/staff-repository.port';

export interface GetStaffByIdUseCaseResult {
  id: string;
  email: string;
  name: string | null;
  role: 'MANAGER' | 'STAFF';
  isActive: boolean;
  createdAt: string;
}

@Injectable()
export class GetStaffByIdUseCase {
  constructor(@Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository) {}

  async execute(id: string, tenantId: string): Promise<GetStaffByIdUseCaseResult> {
    const staff = await this.staffRepo.findById(id, tenantId);
    if (!staff) throw new StaffNotFoundError(id);

    return {
      id: staff.id,
      email: staff.email.address,
      name: staff.name,
      role: staff.role,
      isActive: staff.isActive,
      createdAt: staff.createdAt.toISOString(),
    };
  }
}
