import { Injectable } from '@nestjs/common';
import { GetTenantSettingsUseCase } from '../../../platform/application/use-cases/get-tenant-settings.use-case';
import { BusinessHours } from '../../../platform/domain/value-objects/tenant-settings.vo';
import { IScheduleTenantSettingsPort } from '../../application/ports/schedule-tenant-settings.port';

@Injectable()
export class ScheduleTenantSettingsAdapter implements IScheduleTenantSettingsPort {
  constructor(private readonly getTenantSettings: GetTenantSettingsUseCase) {}

  async getBusinessHours(tenantId: string): Promise<BusinessHours> {
    const { settings } = await this.getTenantSettings.execute(tenantId);
    return settings.business_hours;
  }
}
