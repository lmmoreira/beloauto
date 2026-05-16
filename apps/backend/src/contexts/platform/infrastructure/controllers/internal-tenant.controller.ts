import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../../../../shared/guards/platform-admin.guard';
import { ProblemDetail } from '../../../../shared/http/problem-detail';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import {
  ProvisionTenantDto,
  ProvisionTenantSchema,
} from '../../application/dtos/provision-tenant.dto';
import { ProvisionTenantUseCase } from '../../application/use-cases/provision-tenant.use-case';
import { PlatformDomainError } from '../../domain/errors/platform-domain.error';

@Controller('internal/tenants')
@UseGuards(PlatformAdminGuard)
export class InternalTenantController {
  constructor(private readonly provisionTenant: ProvisionTenantUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(ProvisionTenantSchema))
  async provision(@Body() dto: ProvisionTenantDto) {
    try {
      return await this.provisionTenant.execute(dto);
    } catch (err) {
      if (err instanceof PlatformDomainError) {
        const body: ProblemDetail = {
          type: 'about:blank',
          title: 'Bad Request',
          status: HttpStatus.BAD_REQUEST,
          detail: err.message,
        };
        throw new HttpException(body, HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }
}
