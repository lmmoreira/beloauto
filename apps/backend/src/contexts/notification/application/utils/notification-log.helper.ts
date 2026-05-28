import { ITransactionManager } from '../../../../shared/ports/transaction-manager.port';
import { NotificationLog } from '../../domain/notification-log.entity';
import { INotificationDispatcher } from '../ports/notification-dispatcher.port';
import { INotificationLogRepository } from '../ports/notification-log-repository.port';
import { INotificationStaffPort } from '../ports/notification-staff.port';

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

export async function dispatchAdminEmailToManagers(
  deps: {
    staffPort: INotificationStaffPort;
    dispatcher: INotificationDispatcher;
    logRepo: INotificationLogRepository;
    txManager: ITransactionManager;
  },
  ctx: {
    tenantId: string;
    eventId: string;
    notificationType: string;
    subject: string;
    templateKey: string;
    data: Record<string, unknown>;
  },
): Promise<boolean> {
  const managerEmails = await deps.staffPort.getManagerEmails(ctx.tenantId);
  if (managerEmails.length === 0) return false;
  await Promise.all(
    managerEmails.map((email) =>
      deps.dispatcher.dispatch({
        tenantId: ctx.tenantId,
        to: email,
        subject: ctx.subject,
        templateKey: ctx.templateKey,
        data: ctx.data,
      }),
    ),
  );
  await saveNotificationLog(
    deps.logRepo,
    deps.txManager,
    ctx.tenantId,
    ctx.eventId,
    ctx.notificationType,
    'EMAIL',
  );
  return true;
}
