import { IHotsiteConfigRepository } from '../../../contexts/platform/application/ports/hotsite-config-repository.port';
import { HotsiteConfig } from '../../../contexts/platform/domain/hotsite-config.aggregate';

export class InMemoryHotsiteConfigRepository implements IHotsiteConfigRepository {
  private readonly store = new Map<string, HotsiteConfig>();

  async findByTenantId(tenantId: string): Promise<HotsiteConfig | null> {
    return this.store.get(tenantId) ?? null;
  }

  async save(config: HotsiteConfig): Promise<void> {
    this.store.set(config.tenantId, config);
  }
}
