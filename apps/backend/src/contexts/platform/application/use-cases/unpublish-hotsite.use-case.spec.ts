import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { HotsiteConfigBuilder } from '../../../../test/builders/platform';
import { InMemoryHotsiteConfigRepository } from '../../../../test/repositories/platform/in-memory-hotsite-config.repository';
import { HotsiteNotFoundError } from '../../domain/errors/platform-domain.error';
import { UnpublishHotsiteUseCase } from './unpublish-hotsite.use-case';

const TENANT_A = '10000000-0000-4000-8000-000000000001';
const TENANT_B = '10000000-0000-4000-8000-000000000002';

describe('UnpublishHotsiteUseCase', () => {
  let repo: InMemoryHotsiteConfigRepository;
  let useCase: UnpublishHotsiteUseCase;

  beforeEach(() => {
    repo = new InMemoryHotsiteConfigRepository();
    useCase = new UnpublishHotsiteUseCase(
      repo,
      new InMemoryTransactionManager(),
      new TenantContextBuilder().withTenantId(TENANT_A).build(),
    );
  });

  it('throws HotsiteNotFoundError when no config exists for the tenant', async () => {
    await expect(useCase.execute()).rejects.toBeInstanceOf(HotsiteNotFoundError);
  });

  it('unpublishes a published hotsite and persists the change', async () => {
    const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildPublished();
    await repo.save(config);

    const result = await useCase.execute();

    expect(result.isPublished).toBe(false);
    const saved = await repo.findByTenantId(TENANT_A);
    expect(saved!.isPublished).toBe(false);
  });

  it('is idempotent when the hotsite is already unpublished', async () => {
    const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildWithContent();
    await repo.save(config);

    const result = await useCase.execute();

    expect(result.isPublished).toBe(false);
  });

  it('tenant isolation: unpublishing tenant A does not affect tenant B', async () => {
    const configA = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildPublished();
    const configB = new HotsiteConfigBuilder().withTenantId(TENANT_B).buildPublished();
    await repo.save(configA);
    await repo.save(configB);

    await useCase.execute();

    const savedB = await repo.findByTenantId(TENANT_B);
    expect(savedB!.isPublished).toBe(true);
  });
});
