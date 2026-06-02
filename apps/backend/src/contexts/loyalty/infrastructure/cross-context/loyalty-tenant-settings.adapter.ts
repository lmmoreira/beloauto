import { Injectable } from '@nestjs/common';
import { GetTenantByIdUseCase } from '../../../platform/application/use-cases/get-tenant-by-id.use-case';
import {
  ILoyaltyTenantSettingsPort,
  LoyaltyTenantSettings,
} from '../../application/ports/loyalty-tenant-settings.port';

const DEFAULTS: LoyaltyTenantSettings = { expiryDays: 180, notificationMinPoints: 50 };

@Injectable()
export class LoyaltyTenantSettingsAdapter implements ILoyaltyTenantSettingsPort {
  constructor(private readonly getTenantById: GetTenantByIdUseCase) {}

  async getLoyaltySettings(tenantId: string): Promise<LoyaltyTenantSettings> {
    try {
      const result = await this.getTenantById.execute(tenantId);
      return {
        expiryDays: result.settings.loyalty.expiry_days,
        notificationMinPoints: result.settings.loyalty.notification_min_points,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
