export const NOTIFICATION_CUSTOMER_PORT = Symbol('INotificationCustomerPort');

export interface NotificationCustomerInfo {
  email: string;
  name: string;
}

export interface INotificationCustomerPort {
  getCustomerInfo(customerId: string, tenantId: string): Promise<NotificationCustomerInfo | null>;
}
