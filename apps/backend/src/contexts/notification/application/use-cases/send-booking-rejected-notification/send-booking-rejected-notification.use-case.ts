import { Inject, Injectable } from '@nestjs/common';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { NotificationLog } from '../../../domain/notification-log.entity';
import { SendBookingRejectedNotificationDto } from '../../dtos/send-booking-rejected-notification.dto';
import {
  INotificationDispatcher,
  NOTIFICATION_DISPATCHER,
} from '../../ports/notification-dispatcher.port';
import {
  INotificationLogRepository,
  NOTIFICATION_LOG_REPOSITORY,
} from '../../ports/notification-log-repository.port';

const NOTIFICATION_TYPE = 'BOOKING_REJECTED_CUSTOMER';
const CHANNEL = 'EMAIL';

export interface SendBookingRejectedNotificationUseCaseResult {
  emailSent: boolean;
}

@Injectable()
export class SendBookingRejectedNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly dispatcher: INotificationDispatcher,
    @Inject(TRANSACTION_MANAGER)
    private readonly txManager: ITransactionManager,
  ) {}

  async execute(
    dto: SendBookingRejectedNotificationDto,
  ): Promise<SendBookingRejectedNotificationUseCaseResult> {
    const existing = await this.logRepo.findByEventAndChannel(
      dto.tenantId,
      dto.eventId,
      NOTIFICATION_TYPE,
      CHANNEL,
    );
    if (existing) return { emailSent: false };

    await this.dispatcher.dispatch({
      tenantId: dto.tenantId,
      to: dto.guestEmail,
      subject: 'Sobre seu pedido de agendamento',
      templateKey: 'booking-rejected-customer',
      data: {
        guestName: dto.guestName,
        reason: dto.reason,
      },
    });

    const log = NotificationLog.create({
      tenantId: dto.tenantId,
      eventId: dto.eventId,
      notificationType: NOTIFICATION_TYPE,
      channel: CHANNEL,
    });
    await this.txManager.run(async () => {
      await this.logRepo.save(log);
    });

    return { emailSent: true };
  }
}
