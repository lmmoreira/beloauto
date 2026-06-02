import { Inject, Injectable } from '@nestjs/common';
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
import { NotificationTemplateKey } from '../../../domain/notification-template-key.enum';
import { BaseNotificationUseCase } from '../base-notification.use-case';

const CHANNEL = 'EMAIL';
const NOTIFICATION_TYPE = NotificationTemplateKey.POINTS_EXPIRING_SOON;

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
  ) {
    super(logRepo, processedEventRepo, dispatcher, txManager);
  }

  async execute(
    dto: SendPointsExpiringSoonNotificationDto,
  ): Promise<SendPointsExpiringSoonNotificationUseCaseResult> {
    if (await this.isAlreadySent(dto.eventId, NOTIFICATION_TYPE, CHANNEL)) {
      return { emailSent: false };
    }

    const customer = await this.customerPort.getCustomerInfo(dto.customerId, dto.tenantId);
    if (!customer) return { emailSent: false };

    try {
      await this.dispatcher.dispatch({
        tenantId: dto.tenantId,
        to: customer.email,
        subject: 'Seus pontos de fidelidade estão prestes a expirar!',
        templateKey: NOTIFICATION_TYPE,
        data: {
          customerName: customer.name,
          pointsExpiringSoon: dto.pointsExpiringSoon,
          earliestExpiresAt: dto.earliestExpiresAt,
        },
      });
      await this.saveLog(dto.tenantId, dto.eventId, NOTIFICATION_TYPE, CHANNEL, customer.email);
      return { emailSent: true };
    } catch (err: unknown) {
      await this.saveFailedLog(
        dto.tenantId,
        dto.eventId,
        NOTIFICATION_TYPE,
        CHANNEL,
        customer.email,
        String(err),
      );
      throw err;
    }
  }
}
