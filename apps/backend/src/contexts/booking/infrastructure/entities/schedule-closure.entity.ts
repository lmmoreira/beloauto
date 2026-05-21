import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';
import { ClosureReason } from '../../domain/schedule-closure.aggregate';

@Entity('schedule_closures', { schema: 'booking' })
@Index(['tenantId'])
@Unique(['tenantId', 'date'])
export class ScheduleClosureEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 50 })
  reason!: ClosureReason;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'created_at', type: 'timestamptz', update: false })
  createdAt!: Date;
}
