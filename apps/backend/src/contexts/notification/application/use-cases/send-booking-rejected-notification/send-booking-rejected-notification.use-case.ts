import { Inject, Injectable } from '@nestjs/common';
import { NotificationTemplateKey } from '../../../domain/notification-template-key.enum';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { SendBookingRejectedNotificationDto } from '../../dtos/send-booking-rejected-notification.dto';
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
  INotificationTemplateRepository,
  NOTIFICATION_TEMPLATE_REPOSITORY,
} from '../../ports/notification-template-repository.port';
import { BaseNotificationUseCase } from '../base-notification.use-case';

const TRIGGER = NotificationTemplateKey.BOOKING_REJECTED_CUSTOMER;

export interface SendBookingRejectedNotificationUseCaseResult {
  emailSent: boolean;
}

@Injectable()
export class SendBookingRejectedNotificationUseCase extends BaseNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY) logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_PROCESSED_EVENT_REPOSITORY)
    processedEventRepo: INotificationProcessedEventRepository,
    @Inject(NOTIFICATION_DISPATCHER) dispatcher: INotificationDispatcher,
    @Inject(TRANSACTION_MANAGER) txManager: ITransactionManager,
    @Inject(NOTIFICATION_TEMPLATE_REPOSITORY)
    private readonly templateRepo: INotificationTemplateRepository,
  ) {
    super(logRepo, processedEventRepo, dispatcher, txManager);
  }

  async execute(
    dto: SendBookingRejectedNotificationDto,
  ): Promise<SendBookingRejectedNotificationUseCaseResult> {
    const templates = await this.templateRepo.findAllByTriggerEvent(dto.tenantId, TRIGGER);
    if (templates.length === 0) {
      this.logger.warn('No template found — skipping', {
        tenantId: dto.tenantId,
        triggerEvent: TRIGGER,
      });
      return { emailSent: false };
    }

    let emailSent = false;
    for (const template of templates) {
      if (await this.isAlreadySent(dto.eventId, template.triggerEvent, template.channel)) continue;
      const { subject, body } = template.render({ guestName: dto.guestName, reason: dto.reason });
      try {
        await this.dispatcher.dispatch({
          tenantId: dto.tenantId,
          to: dto.guestEmail,
          subject,
          body,
          channel: template.channel,
        });
        await this.saveLog(
          dto.tenantId,
          dto.eventId,
          template.triggerEvent,
          template.channel,
          dto.guestEmail,
        );
        emailSent = true;
      } catch (err: unknown) {
        await this.saveFailedLog(
          dto.tenantId,
          dto.eventId,
          template.triggerEvent,
          template.channel,
          dto.guestEmail,
          String(err),
        );
        throw err;
      }
    }
    return { emailSent };
  }
}
