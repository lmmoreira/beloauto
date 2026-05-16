import { DomainEvent } from '../../../../shared/domain/domain-event';

interface TenantProvisionedData extends Record<string, unknown> {
  tenantId: string;
  name: string;
  slug: string;
  adminEmail: string;
  timezone: string;
}

export interface TenantProvisionedParams {
  name: string;
  slug: string;
  adminEmail: string;
  timezone: string;
}

export class TenantProvisioned extends DomainEvent<TenantProvisionedData> {
  readonly eventName = 'TenantProvisioned';
  readonly eventVersion = 1;
  readonly data: TenantProvisionedData;

  constructor(tenantId: string, correlationId: string, params: TenantProvisionedParams) {
    super(tenantId, correlationId);
    this.data = { tenantId, ...params };
  }
}
