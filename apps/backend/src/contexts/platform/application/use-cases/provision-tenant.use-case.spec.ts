import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { InMemoryHotsiteConfigRepository } from '../../../../test/repositories/platform/in-memory-hotsite-config.repository';
import { InMemoryTenantRepository } from '../../../../test/repositories/platform/in-memory-tenant.repository';
import { SlugAlreadyTakenError } from '../../domain/errors/platform-domain.error';
import { TenantProvisioned } from '../../domain/events/tenant-provisioned.event';
import { ProvisionTenantUseCase } from './provision-tenant.use-case';

describe('ProvisionTenantUseCase', () => {
  let tenantRepo: InMemoryTenantRepository;
  let hotsiteRepo: InMemoryHotsiteConfigRepository;
  let eventBus: InMemoryEventBus;
  let useCase: ProvisionTenantUseCase;

  beforeEach(() => {
    tenantRepo = new InMemoryTenantRepository();
    hotsiteRepo = new InMemoryHotsiteConfigRepository();
    eventBus = new InMemoryEventBus();
    useCase = new ProvisionTenantUseCase(tenantRepo, hotsiteRepo, eventBus);
  });

  it('provisions a tenant and creates a hotsite config', async () => {
    const result = await useCase.execute({
      name: 'Lavacar Belo',
      slug: 'lavacar-belo',
      adminEmail: 'admin@lavacar.com.br',
    });

    expect(result.slug).toBe('lavacar-belo');
    expect(result.name).toBe('Lavacar Belo');
    expect(result.tenantId).toBeDefined();

    const savedTenant = await tenantRepo.findBySlug('lavacar-belo');
    expect(savedTenant).not.toBeNull();
    expect(savedTenant!.settings.business_hours.timezone).toBe('America/Sao_Paulo');

    const savedConfig = await hotsiteRepo.findByTenantId(result.tenantId);
    expect(savedConfig).not.toBeNull();
    expect(savedConfig!.isPublished).toBe(false);
  });

  it('uses the provided timezone instead of the default', async () => {
    await useCase.execute({
      name: 'Lavacar Norte',
      slug: 'lavacar-norte',
      adminEmail: 'admin@norte.com.br',
      timezone: 'America/Manaus',
    });

    const tenant = await tenantRepo.findBySlug('lavacar-norte');
    expect(tenant!.settings.business_hours.timezone).toBe('America/Manaus');
  });

  it('publishes TenantProvisioned event with correct payload', async () => {
    await useCase.execute({
      name: 'Lavacar Sul',
      slug: 'lavacar-sul',
      adminEmail: 'sul@lavacar.com.br',
    });

    expect(eventBus.published).toHaveLength(1);
    const event = eventBus.published[0] as TenantProvisioned;
    expect(event.eventName).toBe('TenantProvisioned');
    expect(event.data.slug).toBe('lavacar-sul');
    expect(event.data.adminEmail).toBe('sul@lavacar.com.br');
    expect(event.data.timezone).toBe('America/Sao_Paulo');
    expect(event.tenantId).toBe(event.data.tenantId);
  });

  it('throws SlugAlreadyTakenError when slug is already taken', async () => {
    await useCase.execute({ name: 'A', slug: 'taken-slug', adminEmail: 'a@a.com' });

    await expect(
      useCase.execute({ name: 'B', slug: 'taken-slug', adminEmail: 'b@b.com' }),
    ).rejects.toThrow(SlugAlreadyTakenError);
  });

  it('compensates by deleting the tenant if hotsite save fails', async () => {
    jest.spyOn(hotsiteRepo, 'save').mockRejectedValue(new Error('db error'));

    await expect(
      useCase.execute({ name: 'A', slug: 'fail-slug', adminEmail: 'a@a.com' }),
    ).rejects.toThrow('db error');

    expect(await tenantRepo.findBySlug('fail-slug')).toBeNull();
  });

  it('tenant isolation — two tenants get separate hotsite configs', async () => {
    const resA = await useCase.execute({ name: 'A', slug: 'iso-a', adminEmail: 'a@a.com' });
    const resB = await useCase.execute({ name: 'B', slug: 'iso-b', adminEmail: 'b@b.com' });

    const configA = await hotsiteRepo.findByTenantId(resA.tenantId);
    const configB = await hotsiteRepo.findByTenantId(resB.tenantId);

    expect(configA).not.toBeNull();
    expect(configB).not.toBeNull();
    expect(configA!.id).not.toBe(configB!.id);
    expect(configA!.tenantId).toBe(resA.tenantId);
    expect(configB!.tenantId).toBe(resB.tenantId);
  });
});
