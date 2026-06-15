import { Inject, Injectable } from '@nestjs/common';
import {
  HOTSITE_CONFIG_REPOSITORY,
  IHotsiteConfigRepository,
} from '../ports/hotsite-config-repository.port';
import { ITenantRepository, TENANT_REPOSITORY } from '../ports/tenant-repository.port';

export interface PublishedHotsiteResult {
  slug: string;
  updatedAt: string;
}

export interface ListPublishedHotsitesUseCaseResult {
  items: PublishedHotsiteResult[];
}

@Injectable()
export class ListPublishedHotsitesUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository,
    @Inject(HOTSITE_CONFIG_REPOSITORY) private readonly hotsiteConfigRepo: IHotsiteConfigRepository,
  ) {}

  async execute(): Promise<ListPublishedHotsitesUseCaseResult> {
    const tenants = await this.tenantRepo.findAllActive();

    const items: PublishedHotsiteResult[] = [];
    for (const tenant of tenants) {
      const config = await this.hotsiteConfigRepo.findByTenantId(tenant.id);
      if (config?.isPublished) {
        items.push({ slug: tenant.slug.value, updatedAt: config.updatedAt.toISOString() });
      }
    }

    return { items };
  }
}
