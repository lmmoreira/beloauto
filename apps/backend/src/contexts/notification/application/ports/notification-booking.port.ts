export const NOTIFICATION_BOOKING_PORT = Symbol('INotificationBookingPort');

export interface NotificationServiceInfo {
  serviceId: string;
  serviceName: string;
}

export interface INotificationBookingPort {
  findServicesByIds(tenantId: string, serviceIds: string[]): Promise<NotificationServiceInfo[]>;
}
