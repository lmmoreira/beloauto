import { Inject, Injectable } from '@nestjs/common';
import { TenantNotFoundError } from '../../domain/errors/platform-domain.error';
import { ITenantRepository, TENANT_REPOSITORY } from '../ports/tenant-repository.port';
import { TenantSettingsProps } from '../../domain/value-objects/tenant-settings.vo';

export interface GetTenantSettingsUseCaseResult {
  settings: TenantSettingsProps;
}

@Injectable()
export class GetTenantSettingsUseCase {
  constructor(@Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository) {}

  async execute(tenantId: string): Promise<GetTenantSettingsUseCaseResult> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new TenantNotFoundError(tenantId);
    return { settings: tenant.settings.toJSON() };
  }
}
