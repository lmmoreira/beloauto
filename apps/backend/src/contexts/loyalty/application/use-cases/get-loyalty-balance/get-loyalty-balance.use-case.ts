import { Inject, Injectable } from '@nestjs/common';
import {
  ILoyaltyBalanceRepository,
  LOYALTY_BALANCE_REPOSITORY,
} from '../../ports/loyalty-balance-repository.port';
import {
  ILoyaltyEntryRepository,
  LOYALTY_ENTRY_REPOSITORY,
} from '../../ports/loyalty-entry-repository.port';

export interface GetLoyaltyBalanceDto {
  tenantId: string;
  customerId: string;
}

export interface GetLoyaltyBalanceResult {
  currentPoints: number;
  nextExpiryDate: string | null;
  nextExpiryPoints: number | null;
}

@Injectable()
export class GetLoyaltyBalanceUseCase {
  constructor(
    @Inject(LOYALTY_BALANCE_REPOSITORY) private readonly balanceRepo: ILoyaltyBalanceRepository,
    @Inject(LOYALTY_ENTRY_REPOSITORY) private readonly entryRepo: ILoyaltyEntryRepository,
  ) {}

  async execute(dto: GetLoyaltyBalanceDto): Promise<GetLoyaltyBalanceResult> {
    const [balance, nextExpiry] = await Promise.all([
      this.balanceRepo.findByCustomer(dto.tenantId, dto.customerId),
      this.entryRepo.findNextExpiry(dto.tenantId, dto.customerId),
    ]);

    return {
      currentPoints: balance?.currentPoints ?? 0,
      nextExpiryDate: nextExpiry ? nextExpiry.expiryDate.toISOString() : null,
      nextExpiryPoints: nextExpiry ? nextExpiry.points : null,
    };
  }
}
