import { TenantContext } from '../../shared/tenant/tenant-context';

export function makeTenantContext(
  tenantId: string,
  overrides?: {
    correlationId?: string;
    actorId?: string;
    actorType?: 'STAFF' | 'CUSTOMER';
    actorRole?: string;
  },
): TenantContext {
  return {
    tenantId,
    correlationId: overrides?.correlationId ?? 'corr-test',
    actorId: overrides?.actorId,
    actorType: overrides?.actorType,
    actorRole: overrides?.actorRole,
  } as unknown as TenantContext;
}
