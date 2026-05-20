import { INotificationLogRepository } from '../../../contexts/notification/application/ports/notification-log-repository.port';
import { NotificationLog } from '../../../contexts/notification/domain/notification-log.entity';

export class InMemoryNotificationLogRepository implements INotificationLogRepository {
  private readonly store: NotificationLog[] = [];

  async findByEventAndChannel(
    tenantId: string,
    eventId: string,
    notificationType: string,
    channel: string,
  ): Promise<NotificationLog | null> {
    return (
      this.store.find(
        (l) =>
          l.tenantId === tenantId &&
          l.eventId === eventId &&
          l.notificationType === notificationType &&
          l.channel === channel,
      ) ?? null
    );
  }

  async save(log: NotificationLog): Promise<void> {
    this.store.push(log);
  }

  get all(): NotificationLog[] {
    return [...this.store];
  }
}
