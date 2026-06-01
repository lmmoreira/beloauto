import {
  ActiveTenantInfo,
  IReminderTenantPort,
} from '../../contexts/booking/application/ports/reminder-tenant.port';

export class InMemoryReminderTenantPort implements IReminderTenantPort {
  private readonly tenants: ActiveTenantInfo[] = [];

  seed(tenants: ActiveTenantInfo[]): void {
    this.tenants.push(...tenants);
  }

  async findAllActive(): Promise<ActiveTenantInfo[]> {
    return [...this.tenants];
  }

  clear(): void {
    this.tenants.length = 0;
  }
}
