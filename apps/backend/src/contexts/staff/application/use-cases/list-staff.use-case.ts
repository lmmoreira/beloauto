import { Inject, Injectable } from '@nestjs/common';
import { IStaffRepository, STAFF_REPOSITORY } from '../ports/staff-repository.port';

export interface StaffItemResult {
  id: string;
  email: string;
  name: string | null;
  role: 'MANAGER' | 'STAFF';
  isActive: boolean;
  createdAt: string;
}

export interface ListStaffUseCaseResult {
  items: StaffItemResult[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

@Injectable()
export class ListStaffUseCase {
  constructor(@Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository) {}

  async execute(tenantId: string, limit: number, offset: number): Promise<ListStaffUseCaseResult> {
    const { items, total } = await this.staffRepo.findAllByTenant(tenantId, limit, offset);
    const hasMore = offset + items.length < total;

    return {
      items: items.map((s) => ({
        id: s.id,
        email: s.email.address,
        name: s.name,
        role: s.role,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
      })),
      pagination: {
        limit,
        offset,
        total,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      },
    };
  }
}
