import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InMemoryHotsiteConfigRepository } from '../../../../test/repositories/platform/in-memory-hotsite-config.repository';
import { InMemoryTenantRepository } from '../../../../test/repositories/platform/in-memory-tenant.repository';
import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { HOTSITE_CONFIG_REPOSITORY } from '../../application/ports/hotsite-config-repository.port';
import { TENANT_REPOSITORY } from '../../application/ports/tenant-repository.port';
import { ProvisionTenantUseCase } from '../../application/use-cases/provision-tenant.use-case';
import { EVENT_BUS } from '../../../../shared/ports/event-bus.port';
import { InternalTenantController } from './internal-tenant.controller';

describe('InternalTenantController', () => {
  let controller: InternalTenantController;
  let tenantRepo: InMemoryTenantRepository;
  let eventBus: InMemoryEventBus;

  beforeEach(async () => {
    tenantRepo = new InMemoryTenantRepository();
    eventBus = new InMemoryEventBus();

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalTenantController],
      providers: [
        ProvisionTenantUseCase,
        { provide: TENANT_REPOSITORY, useValue: tenantRepo },
        { provide: HOTSITE_CONFIG_REPOSITORY, useValue: new InMemoryHotsiteConfigRepository() },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile();

    controller = moduleRef.get(InternalTenantController);
  });

  it('provisions a tenant and returns tenantId, name, slug', async () => {
    const result = await controller.provision({
      name: 'Lavacar Belo',
      slug: 'lavacar-belo',
      adminEmail: 'admin@lavacar.com.br',
    });

    expect(result.slug).toBe('lavacar-belo');
    expect(result.name).toBe('Lavacar Belo');
    expect(result.tenantId).toBeDefined();
    expect(eventBus.published).toHaveLength(1);
    expect(eventBus.published[0].eventName).toBe('TenantProvisioned');
  });

  it('maps SlugAlreadyTakenError to 409 HttpException', async () => {
    await controller.provision({ name: 'A', slug: 'taken', adminEmail: 'a@a.com' });

    expect.assertions(2);
    try {
      await controller.provision({ name: 'B', slug: 'taken', adminEmail: 'b@b.com' });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });

  it('maps PlatformDomainError to 400 HttpException for invalid domain input', async () => {
    expect.assertions(2);
    try {
      await controller.provision({ name: '', slug: 'valid', adminEmail: 'a@a.com' });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});
