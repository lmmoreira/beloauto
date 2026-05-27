import { Inject, Injectable } from '@nestjs/common';
import { formatBRL } from '../../../../../shared/utils/money-format';
import { utcDateToLocalDate, utcDateToLocalHHMM } from '../../../../../shared/utils/calendar-date';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { NotificationLog } from '../../../domain/notification-log.entity';
import { SendBookingApprovedNotificationDto } from '../../dtos/send-booking-approved-notification.dto';
import {
  INotificationDispatcher,
  NOTIFICATION_DISPATCHER,
} from '../../ports/notification-dispatcher.port';
import {
  INotificationLogRepository,
  NOTIFICATION_LOG_REPOSITORY,
} from '../../ports/notification-log-repository.port';
import {
  INotificationTenantPort,
  NOTIFICATION_TENANT_PORT,
} from '../../ports/notification-tenant.port';

const NOTIFICATION_TYPE = 'BOOKING_APPROVED_CUSTOMER';
const CHANNEL = 'EMAIL';

export interface SendBookingApprovedNotificationUseCaseResult {
  emailSent: boolean;
}

@Injectable()
export class SendBookingApprovedNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly dispatcher: INotificationDispatcher,
    @Inject(NOTIFICATION_TENANT_PORT)
    private readonly tenantPort: INotificationTenantPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly txManager: ITransactionManager,
  ) {}

  async execute(
    dto: SendBookingApprovedNotificationDto,
  ): Promise<SendBookingApprovedNotificationUseCaseResult> {
    const existing = await this.logRepo.findByEventAndChannel(
      dto.tenantId,
      dto.eventId,
      NOTIFICATION_TYPE,
      CHANNEL,
    );
    if (existing) return { emailSent: false };

    const tenantInfo = await this.tenantPort.getTenantInfo(dto.tenantId);
    const timezone = tenantInfo?.timezone ?? 'America/Sao_Paulo';

    const startDate = new Date(dto.approvedSlot.startTime);
    const localDate = utcDateToLocalDate(startDate, timezone);
    const localTime = utcDateToLocalHHMM(startDate, timezone);

    const serviceNames = dto.lineSummary.map((l) => l.serviceNameAtBooking).join(', ');
    const formattedTotal = formatBRL(dto.totalPrice.amount);
    const lineItems = dto.lineSummary.map(
      (l) => `${l.serviceNameAtBooking}: ${formatBRL(l.priceAtBooking.amount)}`,
    );

    await this.dispatcher.dispatch({
      tenantId: dto.tenantId,
      to: dto.guestEmail,
      subject: 'Seu agendamento foi confirmado! ✓',
      templateKey: 'booking-approved-customer',
      data: {
        guestName: dto.guestName,
        localDate,
        localTime,
        serviceNames,
        lineItems,
        totalPrice: formattedTotal,
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
