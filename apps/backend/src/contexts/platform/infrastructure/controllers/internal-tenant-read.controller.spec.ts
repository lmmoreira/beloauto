import { NotFoundException } from '@nestjs/common';
import { TenantBuilder } from '../../../../test/builders/platform';
import { InMemoryTenantRepository } from '../../../../test/repositories/platform/in-memory-tenant.repository';
import { InternalTenantReadController } from './internal-tenant-read.controller';

describe('InternalTenantReadController', () => {
  let tenantRepo: InMemoryTenantRepository;
  let controller: InternalTenantReadController;

  beforeEach(() => {
    tenantRepo = new InMemoryTenantRepository();
    controller = new InternalTenantReadController(tenantRepo);
  });

  it('throws NotFoundException when tenant does not exist', async () => {
    await expect(controller.findById('unknown-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns id, slug, and name for a known tenant', async () => {
    const tenant = new TenantBuilder().withSlug('lavacar-bh').withName('Lavacar BH').build();
    await tenantRepo.save(tenant);

    const result = await controller.findById(tenant.id);

    expect(result.id).toBe(tenant.id);
    expect(result.slug).toBe('lavacar-bh');
    expect(result.name).toBe('Lavacar BH');
  });
});
