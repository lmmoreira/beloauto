import {
  ILoyaltyTenantSettingsPort,
  LoyaltyTenantSettings,
} from '../../contexts/loyalty/application/ports/loyalty-tenant-settings.port';

export class InMemoryLoyaltyTenantSettingsPort implements ILoyaltyTenantSettingsPort {
  private settings: LoyaltyTenantSettings = { expiryDays: 180, notificationMinPoints: 0 };

  withExpiryDays(days: number): this {
    this.settings = { ...this.settings, expiryDays: days };
    return this;
  }

  withNotificationMinPoints(min: number): this {
    this.settings = { ...this.settings, notificationMinPoints: min };
    return this;
  }

  async getLoyaltySettings(_tenantId: string): Promise<LoyaltyTenantSettings> {
    return { ...this.settings };
  }
}
