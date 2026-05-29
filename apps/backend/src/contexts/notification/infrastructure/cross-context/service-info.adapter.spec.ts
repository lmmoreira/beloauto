import { DataSource, Repository } from 'typeorm';
import { ServiceEntityBuilder } from '../../../../test/builders/booking/index';
import { ServiceEntity } from '../../../booking/infrastructure/entities/service.entity';
import { ServiceInfoAdapter } from './service-info.adapter';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SVC_ID_1 = 'cccccccc-0000-4000-8000-000000000001';
const SVC_ID_2 = 'cccccccc-0000-4000-8000-000000000002';

describe('ServiceInfoAdapter', () => {
  let svcRepo: jest.Mocked<Pick<Repository<ServiceEntity>, 'find'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'getRepository'>>;
  let adapter: ServiceInfoAdapter;

  beforeEach(() => {
    svcRepo = { find: jest.fn() };
    dataSource = { getRepository: jest.fn().mockReturnValue(svcRepo) };
    adapter = new ServiceInfoAdapter(dataSource as unknown as DataSource);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns empty array when serviceIds is empty', async () => {
    const result = await adapter.findServicesByIds(TENANT_ID, []);
    expect(result).toEqual([]);
    expect(svcRepo.find).not.toHaveBeenCalled();
  });

  it('maps service entities to NotificationServiceInfo', async () => {
    svcRepo.find.mockResolvedValue([
      new ServiceEntityBuilder()
        .withId(SVC_ID_1)
        .withTenantId(TENANT_ID)
        .withName('Lavagem Premium')
        .build(),
      new ServiceEntityBuilder()
        .withId(SVC_ID_2)
        .withTenantId(TENANT_ID)
        .withName('Enceramento')
        .build(),
    ]);

    const result = await adapter.findServicesByIds(TENANT_ID, [SVC_ID_1, SVC_ID_2]);

    expect(result).toEqual([
      { serviceId: SVC_ID_1, serviceName: 'Lavagem Premium' },
      { serviceId: SVC_ID_2, serviceName: 'Enceramento' },
    ]);
  });

  it('queries with correct tenantId filter', async () => {
    svcRepo.find.mockResolvedValue([]);

    await adapter.findServicesByIds(TENANT_ID, [SVC_ID_1]);

    expect(svcRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
    );
  });
});
