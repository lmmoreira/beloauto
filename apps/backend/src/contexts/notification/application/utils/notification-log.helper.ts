import {
  ITransactionManager,
} from '../../../../shared/ports/transaction-manager.port';
import { NotificationLog } from '../../domain/notification-log.entity';
import { INotificationLogRepository } from '../ports/notification-log-repository.port';

export async function saveNotificationLog(
  logRepo: INotificationLogRepository,
  txManager: ITransactionManager,
  tenantId: string,
  eventId: string,
  notificationType: string,
  channel: string,
): Promise<void> {
  const log = NotificationLog.create({ tenantId, eventId, notificationType, channel });
  await txManager.run(async () => {
    await logRepo.save(log);
  });
}
