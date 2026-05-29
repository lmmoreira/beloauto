import {
  INotificationServicePort,
  NotificationServiceInfo,
} from '../../contexts/notification/application/ports/notification-service.port';

export class InMemoryNotificationServicePort implements INotificationServicePort {
  private readonly store = new Map<string, NotificationServiceInfo>();

  async getServiceInfo(
    serviceId: string,
    tenantId: string,
  ): Promise<NotificationServiceInfo | null> {
    return this.store.get(`${tenantId}:${serviceId}`) ?? null;
  }

  setService(tenantId: string, info: NotificationServiceInfo): void {
    this.store.set(`${tenantId}:${info.serviceId}`, info);
  }
}
