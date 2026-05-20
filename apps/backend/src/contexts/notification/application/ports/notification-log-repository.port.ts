import { NotificationLog } from '../../domain/notification-log.entity';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('INotificationLogRepository');

export interface INotificationLogRepository {
  findByEventAndChannel(
    tenantId: string,
    eventId: string,
    notificationType: string,
    channel: string,
  ): Promise<NotificationLog | null>;
  save(log: NotificationLog): Promise<void>;
}
