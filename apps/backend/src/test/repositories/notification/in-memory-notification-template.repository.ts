import { INotificationTemplateRepository } from '../../../contexts/notification/application/ports/notification-template-repository.port';
import { NotificationTemplate } from '../../../contexts/notification/domain/notification-template.aggregate';
import { NotificationTemplateKey } from '../../../contexts/notification/domain/notification-template-key.enum';

export class InMemoryNotificationTemplateRepository implements INotificationTemplateRepository {
  private readonly store: NotificationTemplate[] = [];

  async findByTriggerEventAndChannel(
    tenantId: string,
    triggerEvent: NotificationTemplateKey,
    channel: string,
  ): Promise<NotificationTemplate | null> {
    return (
      this.store.find(
        (t) => t.tenantId === tenantId && t.triggerEvent === triggerEvent && t.channel === channel,
      ) ?? null
    );
  }

  async findAllDefaults(): Promise<NotificationTemplate[]> {
    return this.store.filter((t) => t.tenantId === null);
  }

  async saveAll(templates: NotificationTemplate[]): Promise<void> {
    for (const t of templates) {
      this.store.push(t);
    }
  }

  seed(template: NotificationTemplate): void {
    this.store.push(template);
  }
}
