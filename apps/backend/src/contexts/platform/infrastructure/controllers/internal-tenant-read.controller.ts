import { Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../application/ports/tenant-repository.port';

export interface TenantInfoResponse {
  id: string;
  slug: string;
  name: string;
}

// MVP: protected at network level (backend not exposed publicly — BFF-only access).
// Future: add InternalApiGuard checking X-Internal-Key header.
@Controller('internal/tenants')
export class InternalTenantReadController {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository) {}

  @Get(':tenantId')
  async findById(@Param('tenantId', ParseUUIDPipe) tenantId: string): Promise<TenantInfoResponse> {
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
