import { Injectable } from '@nestjs/common';
import { GetTenantByIdUseCase } from '../../../platform/application/use-cases/get-tenant-by-id.use-case';
import {
  BookingSettings,
  BusinessHours,
} from '../../../platform/domain/value-objects/tenant-settings.vo';
import {
  IScheduleTenantSettingsPort,
  SchedulingSettings,
} from '../../application/ports/schedule-tenant-settings.port';

@Injectable()
export class ScheduleTenantSettingsAdapter implements IScheduleTenantSettingsPort {
  constructor(private readonly getTenantById: GetTenantByIdUseCase) {}

  async getBusinessHours(tenantId: string): Promise<BusinessHours> {
    const { settings } = await this.getTenantById.execute(tenantId);
    return settings.business_hours;
  }

  async getBookingSettings(tenantId: string): Promise<BookingSettings> {
    const { settings } = await this.getTenantById.execute(tenantId);
    return settings.booking;
  }

  async getSchedulingSettings(tenantId: string): Promise<SchedulingSettings> {
    const { settings } = await this.getTenantById.execute(tenantId);
    return { businessHours: settings.business_hours, bookingSettings: settings.booking };
  }
}
