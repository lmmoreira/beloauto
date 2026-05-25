import { Address } from '../../../../shared/value-objects/address';

export const CUSTOMER_PROFILE_PORT = Symbol('ICustomerProfilePort');

export interface CustomerProfileDto {
  email: string;
  name: string;
  phone: string | null;
  defaultAddress: Address | null;
}

export interface ICustomerProfilePort {
  findById(customerId: string, tenantId: string): Promise<CustomerProfileDto | null>;
}
