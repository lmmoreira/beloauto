import { DataSource, Repository } from 'typeorm';
import { ServiceEntity } from '../../../booking/infrastructure/entities/service.entity';
import { ServiceCatalogAdapter } from './service-catalog.adapter';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const SVC_ID_1 = '11111111-0000-7000-8000-000000000001';
const SVC_ID_2 = '11111111-0000-7000-8000-000000000002';

function makeEntity(id: string, name: string): ServiceEntity {
  const e = new ServiceEntity();
  e.id = id;
  e.tenantId = TENANT_ID;
  e.name = name;
  return e;
}

describe('ServiceCatalogAdapter', () => {
  let adapter: ServiceCatalogAdapter;
  let svcRepo: jest.Mocked<Pick<Repository<ServiceEntity>, 'find'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'getRepository'>>;

  beforeEach(() => {
    svcRepo = { find: jest.fn() };
    dataSource = {
      getRepository: jest.fn().mockReturnValue(svcRepo),
    };
    adapter = new ServiceCatalogAdapter(dataSource as unknown as DataSource);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns empty array when serviceIds is empty', async () => {
    const result = await adapter.findServicesByIds(TENANT_ID, []);
    expect(result).toEqual([]);
    expect(svcRepo.find).not.toHaveBeenCalled();
  });

  it('maps service entities to ServiceSummary', async () => {
    svcRepo.find.mockResolvedValue([
      makeEntity(SVC_ID_1, 'Lavagem Completa'),
      makeEntity(SVC_ID_2, 'Enceramento'),
    ]);

    const result = await adapter.findServicesByIds(TENANT_ID, [SVC_ID_1, SVC_ID_2]);

    expect(result).toEqual([
      { serviceId: SVC_ID_1, serviceName: 'Lavagem Completa' },
      { serviceId: SVC_ID_2, serviceName: 'Enceramento' },
    ]);
  });

  it('queries with correct tenantId and ids filter', async () => {
    svcRepo.find.mockResolvedValue([makeEntity(SVC_ID_1, 'Lavagem')]);

    await adapter.findServicesByIds(TENANT_ID, [SVC_ID_1]);

    expect(svcRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_ID }) }),
    );
  });
});
