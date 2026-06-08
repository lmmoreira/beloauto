import { InMemoryTenantRepository } from '../../../../test/repositories/platform/in-memory-tenant.repository';
import { TenantBuilder } from '../../../../test/builders/platform/index';
import { GetTenantByIdUseCase } from '../../../platform/application/use-cases/get-tenant-by-id.use-case';
import { TenantQueryService } from '../../../platform/application/services/tenant-query.service';
import { BookingPlatformAdapter } from './booking-platform.adapter';

describe('BookingPlatformAdapter', () => {
  let repo: InMemoryTenantRepository;
  let adapter: BookingPlatformAdapter;

  beforeEach(() => {
    repo = new InMemoryTenantRepository();
    adapter = new BookingPlatformAdapter(
      new GetTenantByIdUseCase(repo),
      new TenantQueryService(repo),
    );
  });

  it('returns business_hours for a known tenant', async () => {
    const tenant = new TenantBuilder().build();
    await repo.save(tenant);

    const hours = await adapter.getBusinessHours(tenant.id);

    expect(hours.monday).toBeDefined();
    expect(hours.sunday).toBeNull();
  });

  it('propagates TenantNotFoundError when tenant does not exist', async () => {
    await expect(adapter.getBusinessHours('unknown-id')).rejects.toThrow();
  });

  it('resolves independently for two different tenants', async () => {
    const tenantA = new TenantBuilder().withSlug('tenant-a').build();
    const tenantB = new TenantBuilder().withSlug('tenant-b').build();
    await repo.save(tenantA);
    await repo.save(tenantB);

    const [hoursA, hoursB] = await Promise.all([
      adapter.getBusinessHours(tenantA.id),
      adapter.getBusinessHours(tenantB.id),
    ]);

    expect(hoursA.monday).toEqual(hoursB.monday);
  });

  it('returns all active tenants with their timezones', async () => {
    const active = new TenantBuilder().build();
    await repo.save(active);

    const result = await adapter.findAllActive();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(active.id);
    expect(result[0].timezone).toBeDefined();
  });
});
