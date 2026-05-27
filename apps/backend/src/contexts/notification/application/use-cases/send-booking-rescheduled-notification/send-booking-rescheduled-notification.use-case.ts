import { Inject, Injectable } from '@nestjs/common';
import { formatBRL } from '../../../../../shared/utils/money-format';
import { utcDateToLocalDate, utcDateToLocalHHMM } from '../../../../../shared/utils/calendar-date';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { saveNotificationLog } from '../../utils/notification-log.helper';
import { SendBookingRescheduledNotificationDto } from '../../dtos/send-booking-rescheduled-notification.dto';
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

const CUSTOMER_NOTIFICATION_TYPE = 'BOOKING_RESCHEDULED_CUSTOMER';
const ADMIN_NOTIFICATION_TYPE = 'BOOKING_RESCHEDULED_ADMIN';
const CHANNEL = 'EMAIL';

export interface SendBookingRescheduledNotificationUseCaseResult {
  customerEmailSent: boolean;
  adminEmailSent: boolean;
}

@Injectable()
export class SendBookingRescheduledNotificationUseCase {
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
    dto: SendBookingRescheduledNotificationDto,
  ): Promise<SendBookingRescheduledNotificationUseCaseResult> {
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

    const previousStart = new Date(dto.previousSlot.startTime);
    const newStart = new Date(dto.newSlot.startTime);

    const previousLocalDate = utcDateToLocalDate(previousStart, timezone);
    const previousLocalTime = utcDateToLocalHHMM(previousStart, timezone);
    const newLocalDate = utcDateToLocalDate(newStart, timezone);
    const newLocalTime = utcDateToLocalHHMM(newStart, timezone);

    const serviceNames = dto.lineSummary.map((l) => l.serviceNameAtBooking).join(', ');
    const formattedTotal = formatBRL(dto.totalPrice.amount);

    let customerEmailSent = false;
    let adminEmailSent = false;

    if (!existingCustomer) {
      await this.dispatcher.dispatch({
        tenantId: dto.tenantId,
        to: dto.guestEmail,
        subject: 'Seu agendamento foi reagendado',
        templateKey: 'booking-rescheduled-customer',
        data: {
          serviceNames,
          totalPrice: formattedTotal,
          guestName: dto.guestName,
          previousLocalDate,
          previousLocalTime,
          newLocalDate,
          newLocalTime,
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
      adminEmailSent = await this.sendAdminEmail(dto.tenantId, dto.eventId, {
        guestName: dto.guestName,
        previousLocalDate,
        previousLocalTime,
        newLocalDate,
        newLocalTime,
        serviceNames,
        totalPrice: formattedTotal,
      });
    }

    return { customerEmailSent, adminEmailSent };
  }

  private async sendAdminEmail(
    tenantId: string,
    eventId: string,
    ctx: {
      guestName: string;
      previousLocalDate: string;
      previousLocalTime: string;
      newLocalDate: string;
      newLocalTime: string;
      serviceNames: string;
      totalPrice: string;
    },
  ): Promise<boolean> {
    const managerEmails = await this.staffPort.getManagerEmails(tenantId);
    if (managerEmails.length === 0) return false;
    await Promise.all(
      managerEmails.map((email) =>
        this.dispatcher.dispatch({
          tenantId,
          to: email,
          subject: 'Agendamento reagendado',
          templateKey: 'booking-rescheduled-admin',
          data: { ...ctx },
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
