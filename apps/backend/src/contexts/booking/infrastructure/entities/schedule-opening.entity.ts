import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity('schedule_openings', { schema: 'booking' })
@Index(['tenantId'])
@Unique(['tenantId', 'date'])
export class ScheduleOpeningEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'created_at', type: 'timestamptz', update: false })
  createdAt!: Date;
}
