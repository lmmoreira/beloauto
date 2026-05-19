import { Inject, Injectable } from '@nestjs/common';
import { TenantNotFoundError } from '../../domain/errors/platform-domain.error';
import { ITenantRepository, TENANT_REPOSITORY } from '../ports/tenant-repository.port';

export interface GetTenantByIdUseCaseResult {
  id: string;
  slug: string;
  name: string;
}

@Injectable()
export class GetTenantByIdUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository) {}

  async execute(tenantId: string): Promise<GetTenantByIdUseCaseResult> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new TenantNotFoundError(tenantId);
    return { id: tenant.id, slug: tenant.slug.value, name: tenant.name };
  }
}
