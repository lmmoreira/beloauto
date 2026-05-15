import {
  BookingSettings,
  BusinessHours,
  LoyaltySettings,
  TenantSettings,
  TenantSettingsProps,
} from '../../../contexts/platform/domain/value-objects/tenant-settings.vo';

export class TenantSettingsPropsBuilder {
  private props: TenantSettingsProps;

  constructor() {
    this.props = TenantSettings.default().toJSON();
  }

  withLoyalty(overrides: Partial<LoyaltySettings>): this {
    this.props.loyalty = { ...this.props.loyalty, ...overrides };
    return this;
  }

  withBooking(overrides: Partial<BookingSettings>): this {
    this.props.booking = { ...this.props.booking, ...overrides };
    return this;
  }

  withBusinessHours(overrides: Partial<BusinessHours>): this {
    this.props.business_hours = { ...this.props.business_hours, ...overrides };
    return this;
  }

  build(): TenantSettingsProps {
    return structuredClone(this.props);
  }
}
