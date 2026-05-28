import { LoyaltyEntry } from '../../domain/loyalty-entry.aggregate';

export const LOYALTY_ENTRY_REPOSITORY = Symbol('LOYALTY_ENTRY_REPOSITORY');

export interface ILoyaltyEntryRepository {
  save(entry: LoyaltyEntry): Promise<void>;
  findActiveByCustomer(tenantId: string, customerId: string): Promise<LoyaltyEntry[]>;
  calculateActiveBalance(tenantId: string, customerId: string): Promise<number>;
  findExpiringBefore(date: Date): Promise<LoyaltyEntry[]>;
}
