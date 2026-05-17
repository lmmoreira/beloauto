import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { EVENT_BUS, IEventBus } from '../../../../shared/ports/event-bus.port';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../shared/ports/transaction-manager.port';
import { HotsiteConfig } from '../../domain/hotsite-config.aggregate';
import { TenantProvisioned } from '../../domain/events/tenant-provisioned.event';
import { SlugAlreadyTakenError } from '../../domain/errors/platform-domain.error';
import { Tenant } from '../../domain/tenant.aggregate';
import {
  HOTSITE_CONFIG_REPOSITORY,
  IHotsiteConfigRepository,
} from '../ports/hotsite-config-repository.port';
import { ITenantRepository, TENANT_REPOSITORY } from '../ports/tenant-repository.port';
import { ProvisionTenantDto } from '../dtos/provision-tenant.dto';

export interface ProvisionTenantResult {
  tenantId: string;
  name: string;
  slug: string;
}

@Injectable()
export class ProvisionTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository,
    @Inject(HOTSITE_CONFIG_REPOSITORY) private readonly hotsiteRepo: IHotsiteConfigRepository,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
  ) {}

  async execute(dto: ProvisionTenantDto): Promise<ProvisionTenantResult> {
    const timezone = dto.timezone ?? 'America/Sao_Paulo';

    if (await this.tenantRepo.existsBySlug(dto.slug)) {
      throw new SlugAlreadyTakenError(dto.slug);
    }

    const tenant = Tenant.create(dto.name, dto.slug, timezone);
    const config = HotsiteConfig.create(tenant.id);

    await this.txManager.run(async () => {
      await this.tenantRepo.save(tenant);
      await this.hotsiteRepo.save(config);
    });

    await this.eventBus.publish(
      new TenantProvisioned(tenant.id, uuidv7(), {
        name: tenant.name,
        slug: tenant.slug.value,
        adminEmail: dto.adminEmail,
        timezone,
      }),
    );

    return { tenantId: tenant.id, name: tenant.name, slug: tenant.slug.value };
  }
}
