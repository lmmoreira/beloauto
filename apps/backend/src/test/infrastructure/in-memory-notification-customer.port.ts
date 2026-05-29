import {
  INotificationCustomerPort,
  NotificationCustomerInfo,
} from '../../contexts/notification/application/ports/notification-customer.port';

export class InMemoryNotificationCustomerPort implements INotificationCustomerPort {
  private readonly store = new Map<string, NotificationCustomerInfo>();

  async getCustomerInfo(
    customerId: string,
    tenantId: string,
  ): Promise<NotificationCustomerInfo | null> {
    return this.store.get(`${tenantId}:${customerId}`) ?? null;
  }

  setCustomer(tenantId: string, customerId: string, info: NotificationCustomerInfo): void {
    this.store.set(`${tenantId}:${customerId}`, info);
  }
}
