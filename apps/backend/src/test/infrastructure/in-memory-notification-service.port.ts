import {
  INotificationServicePort,
  NotificationServiceInfo,
} from '../../contexts/notification/application/ports/notification-service.port';

export class InMemoryNotificationServicePort implements INotificationServicePort {
  private readonly store = new Map<string, NotificationServiceInfo>();

  async findServicesByIds(
    tenantId: string,
    serviceIds: string[],
  ): Promise<NotificationServiceInfo[]> {
    return serviceIds
      .map((id) => this.store.get(`${tenantId}:${id}`))
      .filter((info): info is NotificationServiceInfo => info !== undefined);
  }

  setService(tenantId: string, info: NotificationServiceInfo): void {
    this.store.set(`${tenantId}:${info.serviceId}`, info);
  }
}
