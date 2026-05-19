import { Inject, Injectable } from '@nestjs/common';
import {
  CustomerTenantSummary,
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
} from '../ports/customer-repository.port';

export type GetCustomerTenantsUseCaseResult = CustomerTenantSummary[];

@Injectable()
export class GetCustomerTenantsUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: ICustomerRepository) {}

  execute(googleOAuthId: string): Promise<GetCustomerTenantsUseCaseResult> {
    return this.customerRepo.findAllTenantsByOAuthId(googleOAuthId);
  }
}
