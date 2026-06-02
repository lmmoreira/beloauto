import { Inject, Injectable } from '@nestjs/common';
import { NotificationTemplateKey } from '../../../domain/notification-template-key.enum';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { SendPointsExpiringSoonNotificationDto } from '../../dtos/send-points-expiring-soon-notification.dto';
import {
  INotificationCustomerPort,
  NOTIFICATION_CUSTOMER_PORT,
} from '../../ports/notification-customer.port';
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

const TRIGGER = NotificationTemplateKey.POINTS_EXPIRING_SOON;

export interface SendPointsExpiringSoonNotificationUseCaseResult {
  emailSent: boolean;
}

@Injectable()
export class SendPointsExpiringSoonNotificationUseCase extends BaseNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY) logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_PROCESSED_EVENT_REPOSITORY)
    processedEventRepo: INotificationProcessedEventRepository,
    @Inject(NOTIFICATION_DISPATCHER) dispatcher: INotificationDispatcher,
    @Inject(NOTIFICATION_CUSTOMER_PORT) private readonly customerPort: INotificationCustomerPort,
    @Inject(TRANSACTION_MANAGER) txManager: ITransactionManager,
    @Inject(NOTIFICATION_TEMPLATE_REPOSITORY)
    private readonly templateRepo: INotificationTemplateRepository,
  ) {
    super(logRepo, processedEventRepo, dispatcher, txManager);
  }

  async execute(
    dto: SendPointsExpiringSoonNotificationDto,
  ): Promise<SendPointsExpiringSoonNotificationUseCaseResult> {
    const templates = await this.templateRepo.findAllByTriggerEvent(dto.tenantId, TRIGGER);
    if (templates.length === 0) {
      this.logger.warn('No template found — skipping', {
        tenantId: dto.tenantId,
        triggerEvent: TRIGGER,
      });
      return { emailSent: false };
    }

    const customer = await this.customerPort.getCustomerInfo(dto.customerId, dto.tenantId);
    if (!customer) return { emailSent: false };

    const emailSent = await this.dispatchTemplates(templates, dto, customer.email, {
      customerName: customer.name,
      pointsExpiringSoon: String(dto.pointsExpiringSoon),
      earliestExpiresAt: dto.earliestExpiresAt,
    });
    return { emailSent };
  }
}
