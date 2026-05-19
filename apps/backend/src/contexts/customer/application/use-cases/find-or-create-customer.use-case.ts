import { Inject, Injectable } from '@nestjs/common';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../shared/ports/transaction-manager.port';
import { Customer } from '../../domain/customer.aggregate';
import { FindOrCreateCustomerDto } from '../dtos/find-or-create-customer.dto';
import { CUSTOMER_REPOSITORY, ICustomerRepository } from '../ports/customer-repository.port';

export interface FindOrCreateCustomerUseCaseResult {
  customerId: string;
  created: boolean;
}

@Injectable()
export class FindOrCreateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepo: ICustomerRepository,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
  ) {}

  async execute(dto: FindOrCreateCustomerDto): Promise<FindOrCreateCustomerUseCaseResult> {
    const existing = await this.customerRepo.findByTenantAndOAuthId(
      dto.tenantId,
      dto.googleOAuthId,
    );
    if (existing) return { customerId: existing.id, created: false };

    const customer = Customer.create(dto.tenantId, dto.googleOAuthId, dto.email, dto.name);
    await this.txManager.run(async () => {
      await this.customerRepo.save(customer);
    });
    return { customerId: customer.id, created: true };
  }
}
