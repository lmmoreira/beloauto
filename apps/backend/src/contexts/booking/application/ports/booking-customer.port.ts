import { Address } from '../../../../shared/value-objects/address';

export const BOOKING_CUSTOMER_PORT = Symbol('IBookingCustomerPort');

export interface CustomerProfileDto {
  email: string;
  name: string;
  phone: string | null;
  defaultAddress: Address | null;
}

export interface IBookingCustomerPort {
  findById(customerId: string, tenantId: string): Promise<CustomerProfileDto | null>;
}
