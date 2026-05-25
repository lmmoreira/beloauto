import { Inject, Injectable } from '@nestjs/common';
import { Customer } from '../../domain/customer.aggregate';
import { CUSTOMER_REPOSITORY, ICustomerRepository } from '../ports/customer-repository.port';

@Injectable()
export class CustomerQueryService {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly repo: ICustomerRepository) {}

  findById(id: string, tenantId: string): Promise<Customer | null> {
    return this.repo.findById(id, tenantId);
  }
}
