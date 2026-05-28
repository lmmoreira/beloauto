import { ITransactionManager } from '../../../../shared/ports/transaction-manager.port';
import { NotificationLog } from '../../domain/notification-log.entity';
import { INotificationDispatcher } from '../ports/notification-dispatcher.port';
import { INotificationLogRepository } from '../ports/notification-log-repository.port';

export abstract class BaseNotificationUseCase {
  constructor(
    protected readonly logRepo: INotificationLogRepository,
    protected readonly dispatcher: INotificationDispatcher,
    protected readonly txManager: ITransactionManager,
  ) {}

  protected async isAlreadySent(
    tenantId: string,
    eventId: string,
    notificationType: string,
    channel: string,
  ): Promise<boolean> {
    return !!(await this.logRepo.findByEventAndChannel(
      tenantId,
      eventId,
      notificationType,
      channel,
    ));
  }

  protected async saveLog(
    tenantId: string,
    eventId: string,
    notificationType: string,
    channel: string,
  ): Promise<void> {
    const log = NotificationLog.create({ tenantId, eventId, notificationType, channel });
    await this.txManager.run(async () => {
      await this.logRepo.save(log);
    });
  }
}
