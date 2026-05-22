import {
  BookingSettings,
  BusinessHours,
} from '../../../platform/domain/value-objects/tenant-settings.vo';

export const SCHEDULE_TENANT_SETTINGS_PORT = Symbol('IScheduleTenantSettingsPort');

export interface SchedulingSettings {
  businessHours: BusinessHours;
  bookingSettings: BookingSettings;
}

export interface IScheduleTenantSettingsPort {
  getBusinessHours(tenantId: string): Promise<BusinessHours>;
  getBookingSettings(tenantId: string): Promise<BookingSettings>;
  getSchedulingSettings(tenantId: string): Promise<SchedulingSettings>;
}
