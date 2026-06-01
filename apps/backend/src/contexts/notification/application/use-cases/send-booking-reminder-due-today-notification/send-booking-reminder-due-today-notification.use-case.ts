import { Inject, Injectable } from '@nestjs/common';
import { utcDateToLocalDate, utcDateToLocalHHMM } from '../../../../../shared/utils/calendar-date';
import { NotificationTemplateKey } from '../../../domain/notification-template-key.enum';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { SendBookingReminderDueNotificationDto } from '../../dtos/send-booking-reminder-due-notification.dto';
import {
  INotificationDispatcher,
  NOTIFICATION_DISPATCHER,
} from '../../ports/notification-dispatcher.port';
import {
  INotificationLogRepository,
  NOTIFICATION_LOG_REPOSITORY,
} from '../../ports/notification-log-repository.port';
import {
  INotificationProcessedEventRepository,
  NOTIFICATION_PROCESSED_EVENT_REPOSITORY,
} from '../../ports/processed-event-repository.port';
import {
  INotificationTenantPort,
  NOTIFICATION_TENANT_PORT,
} from '../../ports/notification-tenant.port';
import { BaseNotificationUseCase } from '../base-notification.use-case';

const CHANNEL = 'EMAIL';

export interface SendBookingReminderDueTodayNotificationUseCaseResult {
  emailSent: boolean;
}

@Injectable()
export class SendBookingReminderDueTodayNotificationUseCase extends BaseNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY) logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_PROCESSED_EVENT_REPOSITORY)
    processedEventRepo: INotificationProcessedEventRepository,
    @Inject(NOTIFICATION_DISPATCHER) dispatcher: INotificationDispatcher,
    @Inject(NOTIFICATION_TENANT_PORT) private readonly tenantPort: INotificationTenantPort,
    @Inject(TRANSACTION_MANAGER) txManager: ITransactionManager,
  ) {
    super(logRepo, processedEventRepo, dispatcher, txManager);
  }

  async execute(
    dto: SendBookingReminderDueNotificationDto,
  ): Promise<SendBookingReminderDueTodayNotificationUseCaseResult> {
    if (
      await this.isAlreadySent(
        dto.eventId,
        NotificationTemplateKey.BOOKING_REMINDER_DUE_TODAY,
        CHANNEL,
      )
    ) {
      return { emailSent: false };
    }

    const tenantInfo = await this.tenantPort.getTenantInfo(dto.tenantId);
    const timezone = tenantInfo?.timezone ?? 'America/Sao_Paulo';

    const start = new Date(dto.scheduledAt);
    const localDate = utcDateToLocalDate(start, timezone);
    const localTime = utcDateToLocalHHMM(start, timezone);
    const serviceNames = dto.lines.map((l) => l.serviceName).join(', ');

    try {
      await this.dispatcher.dispatch({
        tenantId: dto.tenantId,
        to: dto.recipientEmail,
        subject: 'Lembrete: seu agendamento é hoje!',
        templateKey: NotificationTemplateKey.BOOKING_REMINDER_DUE_TODAY,
        data: { customerName: dto.customerName, localDate, localTime, serviceNames },
      });
      await this.saveLog(
        dto.tenantId,
        dto.eventId,
        NotificationTemplateKey.BOOKING_REMINDER_DUE_TODAY,
        CHANNEL,
        dto.recipientEmail,
      );
      return { emailSent: true };
    } catch (err: unknown) {
      await this.saveFailedLog(
        dto.tenantId,
        dto.eventId,
        NotificationTemplateKey.BOOKING_REMINDER_DUE_TODAY,
        CHANNEL,
        dto.recipientEmail,
        String(err),
      );
      throw err;
    }
  }
}
