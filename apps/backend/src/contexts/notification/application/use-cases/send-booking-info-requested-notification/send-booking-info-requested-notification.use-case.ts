import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { NotificationLog } from '../../../domain/notification-log.entity';
import { SendBookingInfoRequestedNotificationDto } from '../../dtos/send-booking-info-requested-notification.dto';
import {
  INotificationDispatcher,
  NOTIFICATION_DISPATCHER,
} from '../../ports/notification-dispatcher.port';
import {
  INotificationLogRepository,
  NOTIFICATION_LOG_REPOSITORY,
} from '../../ports/notification-log-repository.port';

const NOTIFICATION_TYPE = 'BOOKING_INFO_REQUESTED_CUSTOMER';
const CHANNEL = 'EMAIL';
const GUEST_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SendBookingInfoRequestedNotificationUseCaseResult {
  emailSent: boolean;
}

@Injectable()
export class SendBookingInfoRequestedNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly dispatcher: INotificationDispatcher,
    @Inject(TRANSACTION_MANAGER)
    private readonly txManager: ITransactionManager,
    private readonly config: ConfigService,
  ) {}

  async execute(
    dto: SendBookingInfoRequestedNotificationDto,
  ): Promise<SendBookingInfoRequestedNotificationUseCaseResult> {
    const existing = await this.logRepo.findByEventAndChannel(
      dto.tenantId,
      dto.eventId,
      NOTIFICATION_TYPE,
      CHANNEL,
    );
    if (existing) return { emailSent: false };

    const respondLink = this.buildRespondLink(dto);

    await this.dispatcher.dispatch({
      tenantId: dto.tenantId,
      to: dto.guestEmail,
      subject: 'Precisamos de mais informações sobre seu agendamento',
      templateKey: 'booking-info-requested-customer',
      data: {
        guestName: dto.guestName,
        informationNeeded: dto.informationNeeded,
        respondLink,
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

  private buildRespondLink(dto: SendBookingInfoRequestedNotificationDto): string {
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    if (dto.customerId !== null) {
      return `${frontendUrl}/dashboard/bookings/${dto.bookingId}`;
    }

    const secret = this.config.getOrThrow<string>('JWT_SECRET');

    const token = jwt.sign(
      { bookingId: dto.bookingId, tenantId: dto.tenantId, guestEmail: dto.guestEmail },
      secret,
      { expiresIn: GUEST_TOKEN_TTL_SECONDS },
    );

    return `${frontendUrl}/bookings/${dto.bookingId}/responder?token=${token}`;
  }
}
