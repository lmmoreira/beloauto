import { Inject, Injectable } from '@nestjs/common';
import { TenantNotFoundError } from '../../domain/errors/platform-domain.error';
import { TenantSettingsProps, TenantSettings } from '../../domain/value-objects/tenant-settings.vo';
import { ITenantRepository, TENANT_REPOSITORY } from '../ports/tenant-repository.port';
import { UpdateTenantSettingsDto } from '../dtos/update-tenant-settings.dto';

export interface UpdateTenantSettingsResult {
  tenantId: string;
  name: string;
  settings: TenantSettingsProps;
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const val = override[key];
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const baseVal = base[key];
      result[key] = (
        baseVal !== null && typeof baseVal === 'object'
          ? deepMerge(baseVal as object, val as object)
          : val
      ) as T[keyof T];
    } else {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

@Injectable()
export class UpdateTenantSettingsUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository) {}

  async execute(
    tenantId: string,
    dto: UpdateTenantSettingsDto,
  ): Promise<UpdateTenantSettingsResult> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new TenantNotFoundError(tenantId);

    if (dto.name !== undefined) {
      tenant.updateName(dto.name);
    }

    if (dto.settings !== undefined) {
      const merged = deepMerge(
        tenant.settings.toJSON(),
        dto.settings as Partial<TenantSettingsProps>,
      );
      tenant.updateSettings(TenantSettings.create(merged));
    }

    await this.tenantRepo.save(tenant);

    return {
      tenantId: tenant.id,
      name: tenant.name,
      settings: tenant.settings.toJSON(),
    };
  }
}
