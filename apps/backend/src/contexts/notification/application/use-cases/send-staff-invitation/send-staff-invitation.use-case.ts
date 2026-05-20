import { Inject, Injectable } from '@nestjs/common';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { NotificationLog } from '../../../domain/notification-log.entity';
import { SendStaffInvitationDto } from '../../dtos/send-staff-invitation.dto';
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

const NOTIFICATION_TYPE = 'STAFF_INVITED';
const CHANNEL = 'EMAIL';

export interface SendStaffInvitationUseCaseResult {
  sent: boolean;
}

@Injectable()
export class SendStaffInvitationUseCase {
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

  async execute(dto: SendStaffInvitationDto): Promise<SendStaffInvitationUseCaseResult> {
    const existing = await this.logRepo.findByEventAndChannel(
      dto.tenantId,
      dto.eventId,
      NOTIFICATION_TYPE,
      CHANNEL,
    );
    if (existing) return { sent: false };

    const [staff, tenant] = await Promise.all([
      this.staffPort.getStaffInfo(dto.staffId, dto.tenantId),
      this.tenantPort.getTenantInfo(dto.tenantId),
    ]);

    if (!staff || !tenant) return { sent: false };

    await this.dispatcher.dispatch({
      tenantId: dto.tenantId,
      to: staff.email,
      subject: `Você foi convidado para a equipe ${tenant.name}`,
      templateKey: 'staff-invitation',
      data: {
        staffName: staff.name ?? staff.email,
        tenantName: tenant.name,
        activationLink: `${process.env['FRONTEND_URL'] ?? 'http://localhost:3000'}/${tenant.slug}/auth/staff`,
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

    return { sent: true };
  }
}
