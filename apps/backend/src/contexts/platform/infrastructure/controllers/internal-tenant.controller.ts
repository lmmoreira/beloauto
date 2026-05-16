import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import {
  ProvisionTenantDto,
  ProvisionTenantSchema,
} from '../../application/dtos/provision-tenant.dto';
import {
  ProvisionTenantResult,
  ProvisionTenantUseCase,
} from '../../application/use-cases/provision-tenant.use-case';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { mapPlatformError } from '../http/platform-error.mapper';

@Controller('internal/tenants')
@UseGuards(PlatformAdminGuard)
export class InternalTenantController {
  constructor(private readonly provisionTenant: ProvisionTenantUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(ProvisionTenantSchema))
  provision(@Body() dto: ProvisionTenantDto): Promise<ProvisionTenantResult> {
    return this.provisionTenant.execute(dto).catch(mapPlatformError);
  }
}
