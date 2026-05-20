import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity('notification_logs', { schema: 'notification' })
@Index(['tenantId'])
@Unique('UQ_notification_logs_event_channel', [
  'tenantId',
  'eventId',
  'notificationType',
  'channel',
])
export class NotificationLogEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'notification_type', type: 'varchar', length: 64 })
  notificationType!: string;

  @Column({ type: 'varchar', length: 32 })
  channel!: string;

  @Column({ name: 'created_at', type: 'timestamptz', update: false })
  createdAt!: Date;
}
