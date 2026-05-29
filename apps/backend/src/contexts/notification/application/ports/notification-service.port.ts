export const NOTIFICATION_SERVICE_PORT = Symbol('INotificationServicePort');

export interface NotificationServiceInfo {
  serviceId: string;
  serviceName: string;
}

export interface INotificationServicePort {
  findServicesByIds(tenantId: string, serviceIds: string[]): Promise<NotificationServiceInfo[]>;
}
