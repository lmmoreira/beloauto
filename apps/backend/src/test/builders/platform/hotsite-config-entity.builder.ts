import { HotsiteConfigEntity } from '../../../contexts/platform/infrastructure/entities/hotsite-config.entity';

export class HotsiteConfigEntityBuilder {
  private id = 'config-id-1';
  private tenantId = 'tenant-id-1';
  private isPublished = false;
  private updatedAt = new Date('2026-01-01T00:00:00Z');

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withIsPublished(isPublished: boolean): this {
    this.isPublished = isPublished;
    return this;
  }

  build(): HotsiteConfigEntity {
    const e = new HotsiteConfigEntity();
    e.id = this.id;
    e.tenantId = this.tenantId;
    e.branding = { primaryColor: '#FFFFFF' };
    e.layout = [{ type: 'HERO', order: 1 }];
    e.isPublished = this.isPublished;
    e.updatedAt = this.updatedAt;
    return e;
  }
}
