import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  GetTenantByIdUseCase,
  TenantInfoDto,
} from '../../application/use-cases/get-tenant-by-id.use-case';
import { mapPlatformError } from '../http/platform-error.mapper';

// MVP: protected at network level (backend not exposed publicly — BFF-only access).
// Future: add InternalApiGuard checking X-Internal-Key header.
@Controller('internal/tenants')
export class InternalTenantReadController {
  constructor(private readonly getTenantById: GetTenantByIdUseCase) {}

  @Get(':tenantId')
  getTenant(@Param('tenantId', ParseUUIDPipe) tenantId: string): Promise<TenantInfoDto> {
    return this.getTenantById.execute(tenantId).catch(mapPlatformError);
  }
}
