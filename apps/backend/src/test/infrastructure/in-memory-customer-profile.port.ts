import {
  CustomerProfileDto,
  ICustomerProfilePort,
} from '../../contexts/booking/application/ports/customer-profile.port';

export class InMemoryCustomerProfilePort implements ICustomerProfilePort {
  private readonly store = new Map<string, CustomerProfileDto>();

  setProfile(customerId: string, profile: CustomerProfileDto): void {
    this.store.set(customerId, profile);
  }

  async findById(customerId: string, _tenantId: string): Promise<CustomerProfileDto | null> {
    return this.store.get(customerId) ?? null;
  }
}
