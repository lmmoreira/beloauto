import { DataSource, Repository } from 'typeorm';
import { TenantEntity } from '../../../platform/infrastructure/entities/tenant.entity';
import { TenantEntityBuilder } from '../../../../test/builders/platform/tenant-entity.builder';
import { TenantSettings } from '../../../platform/domain/value-objects/tenant-settings.vo';
import { ReminderTenantAdapter } from './reminder-tenant.adapter';

const TENANT_ID_1 = '00000000-0000-7000-8000-000000000001';
const TENANT_ID_2 = '00000000-0000-7000-8000-000000000002';

function makeTenantWithTimezone(id: string, timezone: string): TenantEntity {
  const e = new TenantEntityBuilder().withId(id).build();
  e.settings = TenantSettings.default(timezone).toJSON();
  return e;
}

describe('ReminderTenantAdapter', () => {
  let adapter: ReminderTenantAdapter;
  let repo: jest.Mocked<Pick<Repository<TenantEntity>, 'find'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'getRepository'>>;

  beforeEach(() => {
    repo = { find: jest.fn() };
    dataSource = { getRepository: jest.fn().mockReturnValue(repo) };
    adapter = new ReminderTenantAdapter(dataSource as unknown as DataSource);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns empty array when no active tenants', async () => {
    repo.find.mockResolvedValue([]);
    const result = await adapter.findAllActive();
    expect(result).toEqual([]);
  });

  it('maps active tenants to ActiveTenantInfo with timezone', async () => {
    repo.find.mockResolvedValue([
      makeTenantWithTimezone(TENANT_ID_1, 'America/Sao_Paulo'),
      makeTenantWithTimezone(TENANT_ID_2, 'America/New_York'),
    ]);

    const result = await adapter.findAllActive();

    expect(result).toEqual([
      { id: TENANT_ID_1, timezone: 'America/Sao_Paulo' },
      { id: TENANT_ID_2, timezone: 'America/New_York' },
    ]);
  });

  it('queries only active tenants', async () => {
    repo.find.mockResolvedValue([]);
    await adapter.findAllActive();
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('falls back to America/Sao_Paulo when timezone missing from settings', async () => {
    const e = new TenantEntityBuilder().withId(TENANT_ID_1).build();
    // Corrupt the settings to simulate missing timezone
    (e.settings as unknown as Record<string, unknown>)['business_hours'] = undefined;
    repo.find.mockResolvedValue([e]);

    const result = await adapter.findAllActive();
    expect(result[0].timezone).toBe('America/Sao_Paulo');
  });
});
