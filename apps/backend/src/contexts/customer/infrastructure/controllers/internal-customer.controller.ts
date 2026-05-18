import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CustomerTenantSummary } from '../../application/ports/customer-repository.port';
import { GetCustomerTenantsUseCase } from '../../application/use-cases/get-customer-tenants.use-case';

// MVP: protected at network level (backend not exposed publicly — BFF-only access).
// Future: add InternalApiGuard checking X-Internal-Key header.
@Controller('internal/customers')
export class InternalCustomerController {
  constructor(private readonly getCustomerTenants: GetCustomerTenantsUseCase) {}

  @Get('tenants')
  getTenants(@Query('googleOAuthId') googleOAuthId: string): Promise<CustomerTenantSummary[]> {
    if (!googleOAuthId) {
      throw new BadRequestException({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'googleOAuthId query parameter is required',
      });
    }
    return this.getCustomerTenants.execute(googleOAuthId);
  }
}
