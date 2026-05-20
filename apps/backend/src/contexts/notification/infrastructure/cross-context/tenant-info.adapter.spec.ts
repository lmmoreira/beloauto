import {
  GetTenantByIdUseCase,
  GetTenantByIdUseCaseResult,
} from '../../../platform/application/use-cases/get-tenant-by-id.use-case';
import { TenantNotFoundError } from '../../../platform/domain/errors/platform-domain.error';
import { TenantInfoAdapter } from './tenant-info.adapter';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

const tenantResult: GetTenantByIdUseCaseResult = {
  id: TENANT_ID,
  name: 'Lava Car',
  slug: 'lavacar',
};

describe('TenantInfoAdapter', () => {
  let getTenantById: jest.Mocked<Pick<GetTenantByIdUseCase, 'execute'>>;
  let adapter: TenantInfoAdapter;

  beforeEach(() => {
    getTenantById = { execute: jest.fn() };
    adapter = new TenantInfoAdapter(getTenantById as unknown as GetTenantByIdUseCase);
  });

  it('returns tenant info when use case succeeds', async () => {
    getTenantById.execute.mockResolvedValue(tenantResult);

    const result = await adapter.getTenantInfo(TENANT_ID);

    expect(result).toEqual({ id: TENANT_ID, name: 'Lava Car', slug: 'lavacar' });
    expect(getTenantById.execute).toHaveBeenCalledWith(TENANT_ID);
  });

  it('returns null when tenant is not found', async () => {
    getTenantById.execute.mockRejectedValue(new TenantNotFoundError(TENANT_ID));

    const result = await adapter.getTenantInfo(TENANT_ID);

    expect(result).toBeNull();
  });

  it('returns null when any error is thrown', async () => {
    getTenantById.execute.mockRejectedValue(new Error('DB error'));

    const result = await adapter.getTenantInfo(TENANT_ID);

    expect(result).toBeNull();
  });
});
