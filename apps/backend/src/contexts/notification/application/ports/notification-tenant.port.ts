export interface NotificationTenantInfo {
  id: string;
  name: string;
  slug: string;
}

export const NOTIFICATION_TENANT_PORT = Symbol('INotificationTenantPort');

export interface INotificationTenantPort {
  getTenantInfo(tenantId: string): Promise<NotificationTenantInfo | null>;
}
