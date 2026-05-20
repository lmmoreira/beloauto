import { uuidv7 } from '../../../shared/domain/uuid-v7';

export interface NotificationLogProps {
  id: string;
  tenantId: string;
  eventId: string;
  notificationType: string;
  channel: string;
  createdAt: Date;
}

export class NotificationLog {
  readonly id: string;
  readonly tenantId: string;
  readonly eventId: string;
  readonly notificationType: string;
  readonly channel: string;
  readonly createdAt: Date;

  private constructor(props: NotificationLogProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.eventId = props.eventId;
    this.notificationType = props.notificationType;
    this.channel = props.channel;
    this.createdAt = props.createdAt;
  }

  static create(props: Omit<NotificationLogProps, 'id' | 'createdAt'>): NotificationLog {
    return new NotificationLog({
      ...props,
      id: uuidv7(),
      createdAt: new Date(),
    });
  }

  static reconstitute(props: NotificationLogProps): NotificationLog {
    return new NotificationLog(props);
  }
}
