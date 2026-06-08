import {
  BookingSettings,
  BusinessHours,
} from '../../contexts/platform/domain/value-objects/tenant-settings.vo';
import {
  ActiveTenantInfo,
  IBookingPlatformPort,
  SchedulingSettings,
} from '../../contexts/booking/application/ports/booking-platform.port';

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: 'America/Sao_Paulo',
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: { open: '09:00', close: '17:00' },
  sunday: null,
};

const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  cancellation_window_hours: 48,
  auto_approve_enabled: false,
  min_booking_advance_hours: 0,
  max_booking_advance_days: 90,
  service_buffer_minutes: 60,
  slot_granularity_minutes: 30,
};

export class InMemoryBookingPlatformPort implements IBookingPlatformPort {
  private readonly hoursStore = new Map<string, BusinessHours>();
  private readonly bookingStore = new Map<string, BookingSettings>();
  private defaultHours: BusinessHours = { ...DEFAULT_BUSINESS_HOURS };
  private defaultBooking: BookingSettings = { ...DEFAULT_BOOKING_SETTINGS };
  private readonly tenants: ActiveTenantInfo[] = [];

  setBusinessHours(tenantId: string, hours: BusinessHours): void {
    this.hoursStore.set(tenantId, hours);
  }

  setDefaultHours(hours: BusinessHours): void {
    this.defaultHours = hours;
  }

  setBookingSettings(tenantId: string, settings: BookingSettings): void {
    this.bookingStore.set(tenantId, settings);
  }

  setDefaultBookingSettings(settings: BookingSettings): void {
    this.defaultBooking = settings;
  }

  seed(tenants: ActiveTenantInfo[]): void {
    this.tenants.push(...tenants);
  }

  clear(): void {
    this.tenants.length = 0;
  }

  async findAllActive(): Promise<ActiveTenantInfo[]> {
    return [...this.tenants];
  }

  async getBusinessHours(tenantId: string): Promise<BusinessHours> {
    return this.hoursStore.get(tenantId) ?? this.defaultHours;
  }

  async getBookingSettings(tenantId: string): Promise<BookingSettings> {
    return this.bookingStore.get(tenantId) ?? this.defaultBooking;
  }

  async getSchedulingSettings(tenantId: string): Promise<SchedulingSettings> {
    return {
      businessHours: this.hoursStore.get(tenantId) ?? this.defaultHours,
      bookingSettings: this.bookingStore.get(tenantId) ?? this.defaultBooking,
    };
  }
}
