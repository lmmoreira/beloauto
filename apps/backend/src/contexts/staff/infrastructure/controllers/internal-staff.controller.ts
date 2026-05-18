import { BadRequestException, Controller, Get, NotFoundException, Query } from '@nestjs/common';
import {
  GetStaffByOAuthIdUseCase,
  StaffAuthInfo,
} from '../../application/use-cases/get-staff-by-oauth-id.use-case';

// MVP: protected at network level (backend not exposed publicly — BFF-only access).
// Future: add InternalApiGuard checking X-Internal-Key header.
@Controller('internal/staff')
export class InternalStaffController {
  constructor(private readonly getStaffByOAuthId: GetStaffByOAuthIdUseCase) {}

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
    const result = await this.getStaffByOAuthId.execute(googleOAuthId);
    if (!result) {
      throw new NotFoundException({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'No staff member found for this Google account',
      });
    }
    return result;
  }
}
