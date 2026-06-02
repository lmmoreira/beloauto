import { NotificationChannel } from '../../domain/notification-template.aggregate';

export interface OutboundMessage {
  tenantId: string;
  to: string;
  subject: string;
  body: string;
  channel: NotificationChannel;
}

export const NOTIFICATION_DISPATCHER = Symbol('INotificationDispatcher');

export interface INotificationDispatcher {
  dispatch(message: OutboundMessage): Promise<void>;
}
