import { ServiceQueryService } from '../../../booking/application/services/service-query.service';
import { ServiceBuilder } from '../../../../test/builders/booking/service.builder';
import { LoyaltyBookingAdapter } from './loyalty-booking.adapter';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

describe('LoyaltyBookingAdapter', () => {
  let serviceQueryService: jest.Mocked<Pick<ServiceQueryService, 'findByIds'>>;
  let adapter: LoyaltyBookingAdapter;

  beforeEach(() => {
    serviceQueryService = { findByIds: jest.fn() };
    adapter = new LoyaltyBookingAdapter(
      serviceQueryService as unknown as ServiceQueryService,
    );
  });

  afterEach(() => jest.resetAllMocks());

  it('returns service summaries for given IDs', async () => {
    const svc = new ServiceBuilder().withName('Car wash').build();
    serviceQueryService.findByIds.mockResolvedValue([svc]);

    const result = await adapter.findServicesByIds(TENANT_ID, [svc.id]);

    expect(result).toEqual([{ serviceId: svc.id, serviceName: svc.name }]);
    expect(serviceQueryService.findByIds).toHaveBeenCalledWith([svc.id], TENANT_ID);
  });

  it('returns empty array when no IDs provided', async () => {
    const result = await adapter.findServicesByIds(TENANT_ID, []);

    expect(result).toEqual([]);
    expect(serviceQueryService.findByIds).not.toHaveBeenCalled();
  });
});
