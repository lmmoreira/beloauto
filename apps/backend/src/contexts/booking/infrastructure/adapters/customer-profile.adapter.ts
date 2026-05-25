import { Injectable } from '@nestjs/common';
import { CustomerQueryService } from '../../../customer/application/services/customer-query.service';
import {
  CustomerProfileDto,
  ICustomerProfilePort,
} from '../../application/ports/customer-profile.port';

@Injectable()
export class CustomerProfileAdapter implements ICustomerProfilePort {
  constructor(private readonly customerQuery: CustomerQueryService) {}

  async findById(customerId: string, tenantId: string): Promise<CustomerProfileDto | null> {
    const customer = await this.customerQuery.findById(customerId, tenantId);
    if (!customer) return null;
    return {
      email: customer.email.address,
      name: customer.name,
      phone: customer.phone?.value ?? null,
      defaultAddress: customer.defaultAddress,
    };
  }
}
