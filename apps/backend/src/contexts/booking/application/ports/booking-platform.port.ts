import {
  BookingSettings,
  BusinessHours,
} from '../../../platform/domain/value-objects/tenant-settings.vo';

export const BOOKING_PLATFORM_PORT = Symbol('IBookingPlatformPort');

export interface ActiveTenantInfo {
  id: string;
  timezone: string;
}

export interface SchedulingSettings {
  businessHours: BusinessHours;
  bookingSettings: BookingSettings;
}

export interface IBookingPlatformPort {
  findAllActive(): Promise<ActiveTenantInfo[]>;
  getBusinessHours(tenantId: string): Promise<BusinessHours>;
  getBookingSettings(tenantId: string): Promise<BookingSettings>;
  getSchedulingSettings(tenantId: string): Promise<SchedulingSettings>;
}
