export const NOTIFICATION_PLATFORM_PORT = Symbol('INotificationPlatformPort');

export interface NotificationTenantInfo {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  fromEmail: string | null;
}

export interface INotificationPlatformPort {
  getTenantInfo(tenantId: string): Promise<NotificationTenantInfo | null>;
}
