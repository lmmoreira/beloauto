import {
  INotificationPlatformPort,
  NotificationTenantInfo,
} from '../../contexts/notification/application/ports/notification-platform.port';

export class InMemoryNotificationPlatformPort implements INotificationPlatformPort {
  private readonly store = new Map<string, NotificationTenantInfo>();

  async getTenantInfo(tenantId: string): Promise<NotificationTenantInfo | null> {
    return this.store.get(tenantId) ?? null;
  }

  setTenantInfo(tenantId: string, info: NotificationTenantInfo): void {
    this.store.set(tenantId, info);
  }
}
