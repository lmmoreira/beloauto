import {
  HotsiteConfig,
  HotsiteBranding,
  LayoutModule,
} from '../../contexts/platform/domain/hotsite-config.aggregate';

const DEFAULT_TENANT_ID = '01234567-0000-7000-8000-000000000001';
const DEFAULT_BRANDING: HotsiteBranding = { primaryColor: '#FF5733' };
const DEFAULT_LAYOUT: LayoutModule[] = [{ type: 'HERO', order: 1 }];

export class HotsiteConfigBuilder {
  private tenantId = DEFAULT_TENANT_ID;

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  build(): HotsiteConfig {
    return HotsiteConfig.create(this.tenantId);
  }

  buildWithContent(
    branding: HotsiteBranding = DEFAULT_BRANDING,
    layout: LayoutModule[] = DEFAULT_LAYOUT,
  ): HotsiteConfig {
    const config = HotsiteConfig.create(this.tenantId);
    config.updateContent(branding, layout);
    return config;
  }
}
