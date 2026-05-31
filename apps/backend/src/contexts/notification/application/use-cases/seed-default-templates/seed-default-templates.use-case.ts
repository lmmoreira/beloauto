import { Inject, Injectable } from '@nestjs/common';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../../shared/ports/transaction-manager.port';
import { NotificationTemplate } from '../../../domain/notification-template.aggregate';
import {
  INotificationTemplateRepository,
  NOTIFICATION_TEMPLATE_REPOSITORY,
} from '../../ports/notification-template-repository.port';

export interface SeedDefaultTemplatesDto {
  tenantId: string;
}

export interface SeedDefaultTemplatesUseCaseResult {
  seeded: number;
}

@Injectable()
export class SeedDefaultTemplatesUseCase {
  constructor(
    @Inject(NOTIFICATION_TEMPLATE_REPOSITORY)
    private readonly templateRepo: INotificationTemplateRepository,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
  ) {}

  async execute(dto: SeedDefaultTemplatesDto): Promise<SeedDefaultTemplatesUseCaseResult> {
    const defaults = await this.templateRepo.findAllDefaults();

    const copies = defaults.map((d) =>
      NotificationTemplate.create({
        tenantId: dto.tenantId,
        triggerEvent: d.triggerEvent,
        channel: d.channel,
        subject: d.subject,
        body: d.body,
      }),
    );

    if (copies.length > 0) {
      await this.txManager.run(() => this.templateRepo.saveAll(copies));
    }

    return { seeded: copies.length };
  }
}
