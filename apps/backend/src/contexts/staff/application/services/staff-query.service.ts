import { Inject, Injectable } from '@nestjs/common';
import { IStaffRepository, STAFF_REPOSITORY } from '../ports/staff-repository.port';

@Injectable()
export class StaffQueryService {
  constructor(@Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository) {}

  async findManagersByTenant(tenantId: string): Promise<string[]> {
    const { items } = await this.staffRepo.findAllByTenant(tenantId, 1000, 0);
    return items.filter((s) => s.role === 'MANAGER').map((s) => s.email.address);
  }
}
