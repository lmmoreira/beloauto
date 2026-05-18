import { BadRequestException } from '@nestjs/common';
import { CustomerBuilder } from '../../../../test/builders/customer';
import { InMemoryCustomerRepository } from '../../../../test/repositories/customer/in-memory-customer.repository';
import { GetCustomerTenantsUseCase } from '../../application/use-cases/get-customer-tenants.use-case';
import { InternalCustomerController } from './internal-customer.controller';

describe('InternalCustomerController', () => {
  let repo: InMemoryCustomerRepository;
  let controller: InternalCustomerController;

  beforeEach(() => {
    repo = new InMemoryCustomerRepository();
    controller = new InternalCustomerController(new GetCustomerTenantsUseCase(repo));
  });

  it('throws BadRequestException when googleOAuthId is missing', () => {
    expect(() => controller.getTenants('')).toThrow(BadRequestException);
  });

  it('returns empty array when no customer records exist for the googleOAuthId', async () => {
    const result = await controller.getTenants('unknown-sub');

    expect(result).toEqual([]);
  });

  it('returns the matching tenant entries for a known googleOAuthId', async () => {
    const customer = new CustomerBuilder()
      .withTenantId('00000000-0000-0000-0000-000000000001')
      .withGoogleOAuthId('google-sub-123')
      .build();
    await repo.save(customer);

    const result = await controller.getTenants('google-sub-123');

    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe('00000000-0000-0000-0000-000000000001');
    expect(result[0].customerId).toBe(customer.id);
  });

  it('does not leak entries from other google accounts', async () => {
    const customerA = new CustomerBuilder().withGoogleOAuthId('sub-a').build();
    const customerB = new CustomerBuilder().withGoogleOAuthId('sub-b').build();
    await repo.save(customerA);
    await repo.save(customerB);

    const result = await controller.getTenants('sub-a');

    expect(result).toHaveLength(1);
    expect(result[0].customerId).toBe(customerA.id);
  });
});
