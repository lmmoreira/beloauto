import { Inject, Injectable } from '@nestjs/common';
import { formatBRL } from '../../../../../shared/utils/money-format';
import { utcDateToLocalDate, utcDateToLocalHHMM } from '../../../../../shared/utils/calendar-date';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { saveNotificationLog } from '../../utils/notification-log.helper';
import { SendBookingCancelledNotificationDto } from '../../dtos/send-booking-cancelled-notification.dto';
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
import {
  INotificationTenantPort,
  NOTIFICATION_TENANT_PORT,
} from '../../ports/notification-tenant.port';

const CUSTOMER_NOTIFICATION_TYPE = 'BOOKING_CANCELLED_CUSTOMER';
const ADMIN_NOTIFICATION_TYPE = 'BOOKING_CANCELLED_ADMIN';
const CHANNEL = 'EMAIL';

export interface SendBookingCancelledNotificationUseCaseResult {
  customerEmailSent: boolean;
  adminEmailSent: boolean;
}

@Injectable()
export class SendBookingCancelledNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly dispatcher: INotificationDispatcher,
    @Inject(NOTIFICATION_STAFF_PORT)
    private readonly staffPort: INotificationStaffPort,
    @Inject(NOTIFICATION_TENANT_PORT)
    private readonly tenantPort: INotificationTenantPort,
    @Inject(TRANSACTION_MANAGER)
    private readonly txManager: ITransactionManager,
  ) {}

  async execute(
    dto: SendBookingCancelledNotificationDto,
  ): Promise<SendBookingCancelledNotificationUseCaseResult> {
    const [existingCustomer, existingAdmin] = await Promise.all([
      this.logRepo.findByEventAndChannel(
        dto.tenantId,
        dto.eventId,
        CUSTOMER_NOTIFICATION_TYPE,
        CHANNEL,
      ),
      this.logRepo.findByEventAndChannel(
        dto.tenantId,
        dto.eventId,
        ADMIN_NOTIFICATION_TYPE,
        CHANNEL,
      ),
    ]);

    const tenantInfo = await this.tenantPort.getTenantInfo(dto.tenantId);
    const timezone = tenantInfo?.timezone ?? 'America/Sao_Paulo';

    const scheduledDate = new Date(dto.scheduledAt);
    const localDate = utcDateToLocalDate(scheduledDate, timezone);
    const localTime = utcDateToLocalHHMM(scheduledDate, timezone);

    const serviceNames = dto.lineSummary.map((l) => l.serviceNameAtBooking).join(', ');
    const formattedTotal = formatBRL(dto.totalPrice.amount);

    let customerEmailSent = false;
    let adminEmailSent = false;

    if (!existingCustomer) {
      await this.dispatcher.dispatch({
        tenantId: dto.tenantId,
        to: dto.guestEmail,
        subject: 'Seu agendamento foi cancelado',
        templateKey: 'booking-cancelled-customer',
        data: {
          serviceNames,
          totalPrice: formattedTotal,
          guestName: dto.guestName,
          localDate,
          localTime,
        },
      });
      await saveNotificationLog(
        this.logRepo,
        this.txManager,
        dto.tenantId,
        dto.eventId,
        CUSTOMER_NOTIFICATION_TYPE,
        CHANNEL,
      );
      customerEmailSent = true;
    }

    if (!existingAdmin) {
      adminEmailSent = await this.sendAdminEmail(
        dto.tenantId,
        dto.eventId,
        dto.guestName,
        localDate,
        localTime,
        serviceNames,
        formattedTotal,
        dto.cancelledBy,
        dto.isBusiness,
        dto.reason,
      );
    }

    return { customerEmailSent, adminEmailSent };
  }

  private async sendAdminEmail(
    tenantId: string,
    eventId: string,
    guestName: string,
    localDate: string,
    localTime: string,
    serviceNames: string,
    totalPrice: string,
    cancelledBy: string,
    isBusiness: boolean,
    reason: string | null,
  ): Promise<boolean> {
    const managerEmails = await this.staffPort.getManagerEmails(tenantId);
    if (managerEmails.length === 0) return false;
    await Promise.all(
      managerEmails.map((email) =>
        this.dispatcher.dispatch({
          tenantId,
          to: email,
          subject: 'Agendamento cancelado',
          templateKey: 'booking-cancelled-admin',
          data: {
            guestName,
            localDate,
            localTime,
            serviceNames,
            totalPrice,
            cancelledBy,
            isBusiness,
            reason,
          },
        }),
      ),
    );
    await saveNotificationLog(
      this.logRepo,
      this.txManager,
      tenantId,
      eventId,
      ADMIN_NOTIFICATION_TYPE,
      CHANNEL,
    );
    return true;
  }
}
