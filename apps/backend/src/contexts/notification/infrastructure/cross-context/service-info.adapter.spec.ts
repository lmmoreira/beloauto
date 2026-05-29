import { DataSource, Repository } from 'typeorm';
import { ServiceEntityBuilder } from '../../../../test/builders/booking/index';
import { ServiceEntity } from '../../../booking/infrastructure/entities/service.entity';
import { ServiceInfoAdapter } from './service-info.adapter';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SERVICE_ID = 'cccccccc-0000-4000-8000-000000000001';

describe('ServiceInfoAdapter', () => {
  let svcRepo: jest.Mocked<Pick<Repository<ServiceEntity>, 'findOne'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'getRepository'>>;
  let adapter: ServiceInfoAdapter;

  beforeEach(() => {
    svcRepo = { findOne: jest.fn() };
    dataSource = { getRepository: jest.fn().mockReturnValue(svcRepo) };
    adapter = new ServiceInfoAdapter(dataSource as unknown as DataSource);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns serviceId and serviceName when service is found', async () => {
    const entity = new ServiceEntityBuilder()
      .withId(SERVICE_ID)
      .withTenantId(TENANT_ID)
      .withName('Lavagem Premium')
      .build();
    svcRepo.findOne.mockResolvedValue(entity);

    const result = await adapter.getServiceInfo(SERVICE_ID, TENANT_ID);

    expect(result).toEqual({ serviceId: SERVICE_ID, serviceName: 'Lavagem Premium' });
    expect(svcRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SERVICE_ID, tenantId: TENANT_ID } }),
    );
  });

  it('returns null when service is not found', async () => {
    svcRepo.findOne.mockResolvedValue(null);

    const result = await adapter.getServiceInfo(SERVICE_ID, TENANT_ID);

    expect(result).toBeNull();
  });
});
