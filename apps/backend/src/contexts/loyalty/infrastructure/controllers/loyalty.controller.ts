import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import { TenantContext } from '../../../../shared/tenant/tenant-context';
import { StaffOrManagerRoleGuard } from '../../../booking/infrastructure/guards/staff-or-manager-role.guard';
import {
  GetLoyaltyBalanceUseCase,
  GetLoyaltyBalanceResult,
} from '../../application/use-cases/get-loyalty-balance/get-loyalty-balance.use-case';
import {
  GetLoyaltyEntriesUseCase,
  GetLoyaltyEntriesResult,
} from '../../application/use-cases/get-loyalty-entries/get-loyalty-entries.use-case';
import {
  GetLoyaltyRedemptionsUseCase,
  GetLoyaltyRedemptionsResult,
} from '../../application/use-cases/get-loyalty-redemptions/get-loyalty-redemptions.use-case';
import { CustomerRoleGuard } from '../guards/customer-role.guard';
import { mapLoyaltyError } from '../http/loyalty-error.mapper';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

type PaginationQuery = z.infer<typeof PaginationSchema>;

@Controller()
export class LoyaltyController {
  constructor(
    private readonly getLoyaltyBalance: GetLoyaltyBalanceUseCase,
    private readonly getLoyaltyEntries: GetLoyaltyEntriesUseCase,
    private readonly getLoyaltyRedemptions: GetLoyaltyRedemptionsUseCase,
    private readonly tenantContext: TenantContext,
  ) {}

  // ── Customer routes ────────────────────────────────────────────────────────

  @Get('loyalty/balance')
  @UseGuards(CustomerRoleGuard)
  getBalance(): Promise<GetLoyaltyBalanceResult> {
    const { tenantId, actorId } = this.tenantContext;
    return this.getLoyaltyBalance
      .execute({ tenantId, customerId: actorId! })
      .catch(mapLoyaltyError);
  }

  @Get('loyalty/entries')
  @UseGuards(CustomerRoleGuard)
  getEntries(
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationQuery,
  ): Promise<GetLoyaltyEntriesResult> {
    const { tenantId, actorId } = this.tenantContext;
    return this.getLoyaltyEntries
      .execute({ tenantId, customerId: actorId!, ...query })
      .catch(mapLoyaltyError);
  }

  @Get('loyalty/redemptions')
  @UseGuards(CustomerRoleGuard)
  getRedemptions(
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationQuery,
  ): Promise<GetLoyaltyRedemptionsResult> {
    const { tenantId, actorId } = this.tenantContext;
    return this.getLoyaltyRedemptions
      .execute({ tenantId, customerId: actorId!, ...query })
      .catch(mapLoyaltyError);
  }

  // ── Admin routes ──────────────────────────────────────────────────────────

  @Get('customers/:customerId/loyalty/balance')
  @UseGuards(StaffOrManagerRoleGuard)
  getBalanceAdmin(
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<GetLoyaltyBalanceResult> {
    return this.getLoyaltyBalance
      .execute({ tenantId: this.tenantContext.tenantId, customerId })
      .catch(mapLoyaltyError);
  }

  @Get('customers/:customerId/loyalty/entries')
  @UseGuards(StaffOrManagerRoleGuard)
  getEntriesAdmin(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationQuery,
  ): Promise<GetLoyaltyEntriesResult> {
    return this.getLoyaltyEntries
      .execute({ tenantId: this.tenantContext.tenantId, customerId, ...query })
      .catch(mapLoyaltyError);
  }

  @Get('customers/:customerId/loyalty/redemptions')
  @UseGuards(StaffOrManagerRoleGuard)
  getRedemptionsAdmin(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationQuery,
  ): Promise<GetLoyaltyRedemptionsResult> {
    return this.getLoyaltyRedemptions
      .execute({ tenantId: this.tenantContext.tenantId, customerId, ...query })
      .catch(mapLoyaltyError);
  }
}
