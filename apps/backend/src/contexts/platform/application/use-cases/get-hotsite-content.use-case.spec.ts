import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { HotsiteConfigBuilder } from '../../../../test/builders/platform';
import { InMemoryHotsiteConfigRepository } from '../../../../test/repositories/platform/in-memory-hotsite-config.repository';
import { HotsiteNotFoundError } from '../../domain/errors/platform-domain.error';
import { GetHotsiteContentUseCase } from './get-hotsite-content.use-case';

const TENANT_A = '10000000-0000-4000-8000-000000000001';
const TENANT_B = '10000000-0000-4000-8000-000000000002';

describe('GetHotsiteContentUseCase', () => {
  let repo: InMemoryHotsiteConfigRepository;
  let useCase: GetHotsiteContentUseCase;

  beforeEach(() => {
    repo = new InMemoryHotsiteConfigRepository();
    useCase = new GetHotsiteContentUseCase(
      repo,
      new TenantContextBuilder().withTenantId(TENANT_A).build(),
    );
  });

  it('throws HotsiteNotFoundError when no config exists for the tenant', async () => {
    await expect(useCase.execute()).rejects.toBeInstanceOf(HotsiteNotFoundError);
  });

  it('returns branding, layout, isPublished, and updatedAt regardless of publish status', async () => {
    const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildWithContent();
    await repo.save(config);

    const result = await useCase.execute();

    expect(result.isPublished).toBe(false);
    expect(result.branding).toEqual(config.branding);
    expect(result.layout).toEqual(config.layout);
    expect(result.updatedAt).toEqual(config.updatedAt);
  });

  it('tenant isolation: does not return another tenant hotsite config', async () => {
    const configB = new HotsiteConfigBuilder().withTenantId(TENANT_B).buildPublished();
    await repo.save(configB);

    await expect(useCase.execute()).rejects.toBeInstanceOf(HotsiteNotFoundError);
  });
});
