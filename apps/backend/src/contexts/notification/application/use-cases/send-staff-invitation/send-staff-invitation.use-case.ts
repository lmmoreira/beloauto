import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationTemplateKey } from '../../../domain/notification-template-key.enum';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
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
  INotificationProcessedEventRepository,
  NOTIFICATION_PROCESSED_EVENT_REPOSITORY,
} from '../../ports/processed-event-repository.port';
import {
  INotificationStaffPort,
  NOTIFICATION_STAFF_PORT,
} from '../../ports/notification-staff.port';
import {
  INotificationTenantPort,
  NOTIFICATION_TENANT_PORT,
} from '../../ports/notification-tenant.port';
import {
  INotificationTemplateRepository,
  NOTIFICATION_TEMPLATE_REPOSITORY,
} from '../../ports/notification-template-repository.port';
import { BaseNotificationUseCase } from '../base-notification.use-case';

const TRIGGER = NotificationTemplateKey.STAFF_INVITATION;

export interface SendStaffInvitationUseCaseResult {
  sent: boolean;
}

@Injectable()
export class SendStaffInvitationUseCase extends BaseNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY) logRepo: INotificationLogRepository,
    @Inject(NOTIFICATION_PROCESSED_EVENT_REPOSITORY)
    processedEventRepo: INotificationProcessedEventRepository,
    @Inject(NOTIFICATION_DISPATCHER) dispatcher: INotificationDispatcher,
    @Inject(NOTIFICATION_STAFF_PORT) private readonly staffPort: INotificationStaffPort,
    @Inject(NOTIFICATION_TENANT_PORT) private readonly tenantPort: INotificationTenantPort,
    @Inject(TRANSACTION_MANAGER) txManager: ITransactionManager,
    @Inject(NOTIFICATION_TEMPLATE_REPOSITORY)
    private readonly templateRepo: INotificationTemplateRepository,
    private readonly config: ConfigService,
  ) {
    super(logRepo, processedEventRepo, dispatcher, txManager);
  }

  async execute(dto: SendStaffInvitationDto): Promise<SendStaffInvitationUseCaseResult> {
    const templates = await this.templateRepo.findAllByTriggerEvent(dto.tenantId, TRIGGER);
    if (templates.length === 0) {
      this.logger.warn('No template found — skipping', {
        tenantId: dto.tenantId,
        triggerEvent: TRIGGER,
      });
      return { sent: false };
    }

    const [staff, tenant] = await Promise.all([
      this.staffPort.getStaffInfo(dto.staffId, dto.tenantId),
      this.tenantPort.getTenantInfo(dto.tenantId),
    ]);
    if (!staff || !tenant) return { sent: false };

    const activationLink = `${this.config.getOrThrow<string>('FRONTEND_URL')}/${tenant.slug}/auth/staff`;

    let sent = false;
    for (const template of templates) {
      if (await this.isAlreadySent(dto.eventId, template.triggerEvent, template.channel)) continue;
      const { subject, body } = template.render({
        staffName: staff.name ?? staff.email,
        tenantName: tenant.name,
        activationLink,
      });
      try {
        await this.dispatcher.dispatch({
          tenantId: dto.tenantId,
          to: staff.email,
          subject,
          body,
          channel: template.channel,
        });
        await this.saveLog(
          dto.tenantId,
          dto.eventId,
          template.triggerEvent,
          template.channel,
          staff.email,
        );
        sent = true;
      } catch (err: unknown) {
        await this.saveFailedLog(
          dto.tenantId,
          dto.eventId,
          template.triggerEvent,
          template.channel,
          staff.email,
          String(err),
        );
        throw err;
      }
    }
    return { sent };
  }
}
