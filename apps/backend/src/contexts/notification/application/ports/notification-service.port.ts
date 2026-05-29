export const NOTIFICATION_SERVICE_PORT = Symbol('INotificationServicePort');

export interface NotificationServiceInfo {
  serviceId: string;
  serviceName: string;
}

export interface INotificationServicePort {
  getServiceInfo(serviceId: string, tenantId: string): Promise<NotificationServiceInfo | null>;
}
