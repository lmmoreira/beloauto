import { SYSTEM_ACTOR_ID } from '../../../../shared/domain/system-actor';
import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryStaffRepository } from '../../../../test/repositories/staff/in-memory-staff.repository';
import { StaffBuilder } from '../../../../test/builders/staff';
import { TenantProvisioned } from '../../../platform/domain/events/tenant-provisioned.event';
import { StaffInvited } from '../../domain/events/staff-invited.event';
import { TenantProvisionedHandler } from './tenant-provisioned.handler';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CORRELATION_ID = 'corr-provisioned-test';

function makeEvent(
  overrides: Partial<{ tenantId: string; adminEmail: string }> = {},
): TenantProvisioned {
  return new TenantProvisioned(overrides.tenantId ?? TENANT_ID, CORRELATION_ID, {
    name: 'Lava Car',
    slug: 'lavacar',
    adminEmail: overrides.adminEmail ?? 'admin@lavacar.com.br',
    timezone: 'America/Sao_Paulo',
  });
}

describe('TenantProvisionedHandler', () => {
  let repo: InMemoryStaffRepository;
  let eventBus: InMemoryEventBus;
  let handler: TenantProvisionedHandler;

  beforeEach(() => {
    repo = new InMemoryStaffRepository();
    eventBus = new InMemoryEventBus();
    handler = new TenantProvisionedHandler(repo, new InMemoryTransactionManager(), eventBus);
  });

  it('creates an inactive MANAGER staff and publishes StaffInvited', async () => {
    const event = makeEvent();

    await handler.handle(event);

    const staff = await repo.findByTenantAndEmail(TENANT_ID, 'admin@lavacar.com.br');
    expect(staff).not.toBeNull();
    expect(staff!.role).toBe('MANAGER');
    expect(staff!.isActive).toBe(false);
    expect(staff!.googleOAuthId).toBeNull();
    expect(staff!.name).toBeNull();
    expect(staff!.invitedBy).toBe(SYSTEM_ACTOR_ID);
    expect(staff!.tenantId).toBe(TENANT_ID);

    expect(eventBus.published).toHaveLength(1);
    const published = eventBus.published[0] as StaffInvited;
    expect(published.eventName).toBe('StaffInvited');
    expect(published.data.staffId).toBe(staff!.id);
    expect(published.tenantId).toBe(TENANT_ID);
    expect(published.correlationId).toBe(CORRELATION_ID);
  });

  it('is idempotent: handling the same event twice creates exactly one staff row', async () => {
    const event = makeEvent();

    await handler.handle(event);
    await handler.handle(event);

    const result = await repo.findAllByTenant(TENANT_ID, 100, 0);
    expect(result.total).toBe(1);
    expect(eventBus.published).toHaveLength(1);
  });

  it('skips silently when a staff with adminEmail already exists in the tenant', async () => {
    const existing = new StaffBuilder()
      .withTenantId(TENANT_ID)
      .withEmail('admin@lavacar.com.br')
      .build();
    await repo.save(existing);

    await handler.handle(makeEvent());

    const result = await repo.findAllByTenant(TENANT_ID, 100, 0);
    expect(result.total).toBe(1);
    expect(eventBus.published).toHaveLength(0);
  });

  it('propagates correlationId from the incoming TenantProvisioned event', async () => {
    await handler.handle(makeEvent());

    const published = eventBus.published[0] as StaffInvited;
    expect(published.correlationId).toBe(CORRELATION_ID);
  });

  it('tenant isolation: events for different tenants create separate staff rows', async () => {
    const TENANT_B = 'bbbbbbbb-0000-4000-8000-000000000002';

    await handler.handle(makeEvent({ tenantId: TENANT_ID }));
    await handler.handle(makeEvent({ tenantId: TENANT_B }));

    const staffA = await repo.findByTenantAndEmail(TENANT_ID, 'admin@lavacar.com.br');
    const staffB = await repo.findByTenantAndEmail(TENANT_B, 'admin@lavacar.com.br');
    expect(staffA).not.toBeNull();
    expect(staffB).not.toBeNull();
    expect(staffA!.id).not.toBe(staffB!.id);
    expect(eventBus.published).toHaveLength(2);
  });
});
