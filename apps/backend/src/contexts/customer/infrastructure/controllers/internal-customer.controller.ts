import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { CustomerTenantSummary } from '../../application/ports/customer-repository.port';
import {
  FindOrCreateCustomerResult,
  FindOrCreateCustomerUseCase,
} from '../../application/use-cases/find-or-create-customer.use-case';
import { GetCustomerTenantsUseCase } from '../../application/use-cases/get-customer-tenants.use-case';

const FindOrCreateSchema = z.object({
  tenantId: z.uuid(),
  googleOAuthId: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
});

// MVP: protected at network level (backend not exposed publicly — BFF-only access).
// Future: add InternalApiGuard checking X-Internal-Key header.
@Controller('internal/customers')
export class InternalCustomerController {
  constructor(
    private readonly getCustomerTenants: GetCustomerTenantsUseCase,
    private readonly findOrCreateCustomer: FindOrCreateCustomerUseCase,
  ) {}

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

  @Post()
  @HttpCode(HttpStatus.OK)
  async findOrCreate(@Body() body: unknown): Promise<FindOrCreateCustomerResult> {
    const parsed = FindOrCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        type: 'about:blank',
        title: 'Bad Request',
        status: HttpStatus.BAD_REQUEST,
        detail: 'tenantId (UUID), googleOAuthId, email, and name are required',
      });
    }
    return this.findOrCreateCustomer.execute(parsed.data);
  }
}
