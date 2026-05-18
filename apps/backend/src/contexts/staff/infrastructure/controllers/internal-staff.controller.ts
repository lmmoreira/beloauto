import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import {
  ActivateStaffRequestDto,
  ActivateStaffSchema,
} from '../../application/dtos/activate-staff.dto';
import {
  ActivateStaffResult,
  ActivateStaffUseCase,
} from '../../application/use-cases/activate-staff.use-case';
import {
  GetStaffByEmailUseCase,
  StaffByEmailInfo,
} from '../../application/use-cases/get-staff-by-email.use-case';
import {
  GetStaffByOAuthIdUseCase,
  StaffAuthInfo,
} from '../../application/use-cases/get-staff-by-oauth-id.use-case';
import { mapStaffError } from '../http/staff-error.mapper';

// MVP: protected at network level (backend not exposed publicly — BFF-only access).
// Future: add InternalApiGuard checking X-Internal-Key header.
@Controller('internal/staff')
export class InternalStaffController {
  constructor(
    private readonly getStaffByOAuthId: GetStaffByOAuthIdUseCase,
    private readonly getStaffByEmail: GetStaffByEmailUseCase,
    private readonly activateStaff: ActivateStaffUseCase,
  ) {}

  // Static routes must be declared before parameterised routes
  @Get('by-oauth')
  async getByOAuth(@Query('googleOAuthId') googleOAuthId: string): Promise<StaffAuthInfo> {
    if (!googleOAuthId) {
      throw new BadRequestException({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'googleOAuthId query parameter is required',
      });
    }
    return this.getStaffByOAuthId.execute(googleOAuthId).catch(mapStaffError);
  }

  @Get('by-email')
  async getByEmail(
    @Query('email') email: string,
    @Query('tenantId') tenantId: string,
  ): Promise<StaffByEmailInfo> {
    if (!email || !tenantId) {
      throw new BadRequestException({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'email and tenantId query parameters are required',
      });
    }
    const result = await this.getStaffByEmail.execute(email, tenantId);
    if (!result) {
      throw new NotFoundException({
        type: 'about:blank',
        title: 'Not Found',
        status: HttpStatus.NOT_FOUND,
        detail: `No staff member found with email ${email} in this tenant`,
      });
    }
    return result;
  }

  @Post(':staffId/activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @Param('staffId') staffId: string,
    @Body(new ZodValidationPipe(ActivateStaffSchema)) dto: ActivateStaffRequestDto,
  ): Promise<ActivateStaffResult> {
    return this.activateStaff.execute({ staffId, ...dto }).catch(mapStaffError);
  }
}
