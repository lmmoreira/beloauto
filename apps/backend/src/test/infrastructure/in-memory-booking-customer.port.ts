import {
  CustomerProfileDto,
  IBookingCustomerPort,
} from '../../contexts/booking/application/ports/booking-customer.port';

export class InMemoryBookingCustomerPort implements IBookingCustomerPort {
  private readonly store = new Map<string, CustomerProfileDto>();

  setProfile(customerId: string, profile: CustomerProfileDto): void {
    this.store.set(customerId, profile);
  }

  async findById(customerId: string, _tenantId: string): Promise<CustomerProfileDto | null> {
    return this.store.get(customerId) ?? null;
  }
}
