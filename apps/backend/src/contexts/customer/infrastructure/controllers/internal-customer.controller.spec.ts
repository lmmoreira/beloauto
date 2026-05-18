import { BadRequestException } from '@nestjs/common';
import { GetCustomerTenantsUseCase } from '../../application/use-cases/get-customer-tenants.use-case';
import { InternalCustomerController } from './internal-customer.controller';

describe('InternalCustomerController', () => {
  let controller: InternalCustomerController;
  let useCase: jest.Mocked<GetCustomerTenantsUseCase>;

  beforeEach(() => {
    useCase = { execute: jest.fn() } as unknown as jest.Mocked<GetCustomerTenantsUseCase>;
    controller = new InternalCustomerController(useCase);
  });

  it('throws BadRequestException when googleOAuthId is missing', () => {
    expect(() => controller.getTenants('')).toThrow(BadRequestException);
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it('delegates to the use case and returns its result', async () => {
    const summary = [{ tenantId: 'tid-1', customerId: 'cid-1' }];
    useCase.execute.mockResolvedValue(summary);

    const result = await controller.getTenants('google-sub-123');

    expect(useCase.execute).toHaveBeenCalledWith('google-sub-123');
    expect(result).toBe(summary);
  });
});
