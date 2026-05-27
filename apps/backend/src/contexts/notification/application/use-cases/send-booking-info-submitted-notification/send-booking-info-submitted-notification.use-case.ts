import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { NotificationLog } from '../../../domain/notification-log.entity';
import { SendBookingInfoSubmittedNotificationDto } from '../../dtos/send-booking-info-submitted-notification.dto';
import {
  INotificationDispatcher,
  NOTIFICATION_DISPATCHER,
} from '../../ports/notification-dispatcher.port';
import {
  INotificationLogRepository,
  NOTIFICATION_LOG_REPOSITORY,
} from '../../ports/notification-log-repository.port';
import {
  INotificationStaffPort,
  NOTIFICATION_STAFF_PORT,
} from '../../ports/notification-staff.port';

const NOTIFICATION_TYPE = 'BOOKING_INFO_SUBMITTED_ADMIN';
const CHANNEL = 'EMAIL';

export interface SendBookingInfoSubmittedNotificationUseCaseResult {
  emailSent: boolean;
}

@Injectable()
export class SendBookingInfoSubmittedNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly dispatcher: INotificationDispatcher,
    @Inject(NOTIFICATION_STAFF_PORT)
    private readonly staffPort: INotificationStaffPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly txManager: ITransactionManager,
    private readonly config: ConfigService,
  ) {}

  async execute(
    dto: SendBookingInfoSubmittedNotificationDto,
  ): Promise<SendBookingInfoSubmittedNotificationUseCaseResult> {
    const existing = await this.logRepo.findByEventAndChannel(
      dto.tenantId,
      dto.eventId,
      NOTIFICATION_TYPE,
      CHANNEL,
    );
    if (existing) return { emailSent: false };

    const managerEmails = await this.staffPort.getManagerEmails(dto.tenantId);
    if (managerEmails.length === 0) return { emailSent: false };

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const bookingLink = `${frontendUrl}/dashboard/bookings/${dto.bookingId}`;
    const customerResponse =
      typeof dto.infoPayload['notes'] === 'string' ? dto.infoPayload['notes'] : '';

    await Promise.all(
      managerEmails.map((email) =>
        this.dispatcher.dispatch({
          tenantId: dto.tenantId,
          to: email,
          subject: 'Cliente respondeu à solicitação de informações',
          templateKey: 'booking-info-submitted-admin',
          data: {
            submittedByEmail: dto.submittedByEmail,
            bookingId: dto.bookingId,
            customerResponse,
            bookingLink,
          },
        }),
      ),
    );

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
