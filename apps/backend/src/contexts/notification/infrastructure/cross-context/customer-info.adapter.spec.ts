import { CustomerQueryService } from '../../../customer/application/services/customer-query.service';
import { Customer } from '../../../customer/domain/customer.aggregate';
import { CustomerInfoAdapter } from './customer-info.adapter';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CUSTOMER_ID = 'bbbbbbbb-0000-4000-8000-000000000001';

describe('CustomerInfoAdapter', () => {
  let queryService: jest.Mocked<Pick<CustomerQueryService, 'findById'>>;
  let adapter: CustomerInfoAdapter;

  beforeEach(() => {
    queryService = { findById: jest.fn() };
    adapter = new CustomerInfoAdapter(queryService as unknown as CustomerQueryService);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns email and name when customer is found', async () => {
    const customer = Customer.create(TENANT_ID, 'google-sub-1', 'maria@example.com', 'Maria Silva');
    queryService.findById.mockResolvedValue(customer);

    const result = await adapter.getCustomerInfo(CUSTOMER_ID, TENANT_ID);

    expect(result).toEqual({ email: 'maria@example.com', name: 'Maria Silva' }); // email.address used internally
    expect(queryService.findById).toHaveBeenCalledWith(CUSTOMER_ID, TENANT_ID);
  });

  it('returns null when customer is not found', async () => {
    queryService.findById.mockResolvedValue(null);

    const result = await adapter.getCustomerInfo(CUSTOMER_ID, TENANT_ID);

    expect(result).toBeNull();
  });

  it('returns null when query service throws', async () => {
    queryService.findById.mockRejectedValue(new Error('DB error'));

    const result = await adapter.getCustomerInfo(CUSTOMER_ID, TENANT_ID);

    expect(result).toBeNull();
  });
});
