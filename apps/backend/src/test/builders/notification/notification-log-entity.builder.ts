import { uuidv7 } from '../../../shared/domain/uuid-v7';
import { NotificationLogEntity } from '../../../contexts/notification/infrastructure/entities/notification-log.entity';

export class NotificationLogEntityBuilder {
  private id = uuidv7();
  private tenantId = 'aaaaaaaa-0000-4000-8000-000000000001';
  private eventId = 'bbbbbbbb-0000-4000-8000-000000000001';
  private notificationType = 'STAFF_INVITED';
  private channel = 'EMAIL';
  private createdAt = new Date('2026-01-01T00:00:00Z');

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withEventId(eventId: string): this {
    this.eventId = eventId;
    return this;
  }

  withNotificationType(notificationType: string): this {
    this.notificationType = notificationType;
    return this;
  }

  withChannel(channel: string): this {
    this.channel = channel;
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.createdAt = createdAt;
    return this;
  }

  build(): NotificationLogEntity {
    const entity = new NotificationLogEntity();
    entity.id = this.id;
    entity.tenantId = this.tenantId;
    entity.eventId = this.eventId;
    entity.notificationType = this.notificationType;
    entity.channel = this.channel;
    entity.createdAt = this.createdAt;
    return entity;
  }
}
