import { Tenant } from '../../../contexts/platform/domain/tenant.aggregate';

export class TenantBuilder {
  private name = 'BeloAuto';
  private slug = 'beloauto';
  private timezone = 'America/Sao_Paulo';

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withSlug(slug: string): this {
    this.slug = slug;
    return this;
  }

  withTimezone(timezone: string): this {
    this.timezone = timezone;
    return this;
  }

  build(): Tenant {
    return Tenant.create(this.name, this.slug, this.timezone);
  }
}
