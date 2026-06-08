import { ServiceQueryService } from '../../../booking/application/services/service-query.service';
import { ServiceBuilder } from '../../../../test/builders/booking/service.builder';
import { NotificationBookingAdapter } from './notification-booking.adapter';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

describe('NotificationBookingAdapter', () => {
  let serviceQueryService: jest.Mocked<Pick<ServiceQueryService, 'findByIds'>>;
  let adapter: NotificationBookingAdapter;

  beforeEach(() => {
    serviceQueryService = { findByIds: jest.fn() };
    adapter = new NotificationBookingAdapter(
      serviceQueryService as unknown as ServiceQueryService,
    );
  });

  afterEach(() => jest.resetAllMocks());

  it('returns service info for given IDs', async () => {
    const svc = new ServiceBuilder().withName('Full detail').build();
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
