import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import {
  TENANT_REPOSITORY,
  ITenantRepository,
} from '../../application/ports/tenant-repository.port';
import { Inject } from '@nestjs/common';

export interface TenantInfoResponse {
  id: string;
  slug: string;
  name: string;
}

@Controller('internal/tenants')
export class InternalTenantReadController {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository) {}

  @Get(':tenantId')
  async findById(@Param('tenantId') tenantId: string): Promise<TenantInfoResponse> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: `Tenant ${tenantId} not found`,
      });
    }
    return { id: tenant.id, slug: tenant.slug.value, name: tenant.name };
  }
}
