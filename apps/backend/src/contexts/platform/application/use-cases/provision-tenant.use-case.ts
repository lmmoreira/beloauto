import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { EVENT_BUS, IEventBus } from '../../../../shared/ports/event-bus.port';
import { ProblemDetail } from '../../../../shared/http/problem-detail';
import { HotsiteConfig } from '../../domain/hotsite-config.aggregate';
import { TenantProvisioned } from '../../domain/events/tenant-provisioned.event';
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
  ) {}

  async execute(dto: ProvisionTenantDto): Promise<ProvisionTenantResult> {
    const timezone = dto.timezone ?? 'America/Sao_Paulo';

    if (await this.tenantRepo.existsBySlug(dto.slug)) {
      const body: ProblemDetail = {
        type: 'about:blank',
        title: 'Conflict',
        status: HttpStatus.CONFLICT,
        detail: `Slug '${dto.slug}' is already in use`,
      };
      throw new HttpException(body, HttpStatus.CONFLICT);
    }

    const tenant = Tenant.create(dto.name, dto.slug, timezone);
    await this.tenantRepo.save(tenant);

    const config = HotsiteConfig.create(tenant.id);
    await this.hotsiteRepo.save(config);

    await this.eventBus.publish(
      new TenantProvisioned(tenant.id, uuidv7(), {
        name: tenant.name,
        slug: tenant.slug,
        adminEmail: dto.adminEmail,
        timezone,
      }),
    );

    return { tenantId: tenant.id, name: tenant.name, slug: tenant.slug };
  }
}
