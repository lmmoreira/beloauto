import { Inject, Injectable } from '@nestjs/common';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { SendServicePointsEarnedNotificationDto } from '../../dtos/send-service-points-earned-notification.dto';
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
  INotificationServicePort,
  NOTIFICATION_SERVICE_PORT,
} from '../../ports/notification-service.port';
import { BaseNotificationUseCase } from '../base-notification.use-case';

const NOTIFICATION_TYPE = 'SERVICE_POINTS_EARNED';
const CHANNEL = 'EMAIL';

export interface SendServicePointsEarnedNotificationUseCaseResult {
  emailSent: boolean;
}

@Injectable()
export class SendServicePointsEarnedNotificationUseCase extends BaseNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY) logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_DISPATCHER) dispatcher: INotificationDispatcher,
    @Inject(NOTIFICATION_CUSTOMER_PORT) private readonly customerPort: INotificationCustomerPort,
    @Inject(NOTIFICATION_SERVICE_PORT) private readonly servicePort: INotificationServicePort,
    @Inject(TRANSACTION_MANAGER) txManager: ITransactionManager,
  ) {
    super(logRepo, dispatcher, txManager);
  }

  async execute(
    dto: SendServicePointsEarnedNotificationDto,
  ): Promise<SendServicePointsEarnedNotificationUseCaseResult> {
    if (await this.isAlreadySent(dto.tenantId, dto.eventId, NOTIFICATION_TYPE, CHANNEL)) {
      return { emailSent: false };
    }

    const customer = await this.customerPort.getCustomerInfo(dto.customerId, dto.tenantId);
    if (!customer) return { emailSent: false };

    const serviceInfo = await this.servicePort.getServiceInfo(dto.serviceId, dto.tenantId);
    const serviceName = serviceInfo?.serviceName ?? dto.serviceId;

    await this.dispatcher.dispatch({
      tenantId: dto.tenantId,
      to: customer.email,
      subject: `Lavagem concluída! Você ganhou ${dto.pointsEarned} pontos`,
      templateKey: 'service-points-earned',
      data: {
        customerName: customer.name,
        serviceName,
        pointsEarned: dto.pointsEarned,
        expiresAt: dto.expiresAt,
        currentBalance: dto.currentBalance,
      },
    });

    await this.saveLog(dto.tenantId, dto.eventId, NOTIFICATION_TYPE, CHANNEL);
    return { emailSent: true };
  }
}
