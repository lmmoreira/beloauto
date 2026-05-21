import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { uuidv7 } from '../../../shared/domain/uuid-v7';
import { BookingDomainError } from './errors/booking-domain.error';

export enum ClosureReason {
  STAFF_DAY_OFF = 'STAFF_DAY_OFF',
  MAINTENANCE = 'MAINTENANCE',
  HOLIDAY = 'HOLIDAY',
}

export interface ScheduleClosureProps {
  id: string;
  tenantId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  reason: ClosureReason;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}

export class ScheduleClosure extends AggregateRoot {
  private readonly props: ScheduleClosureProps;

  private constructor(props: ScheduleClosureProps) {
    super();
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get date(): string {
    return this.props.date;
  }
  get startTime(): string | null {
    return this.props.startTime;
  }
  get endTime(): string | null {
    return this.props.endTime;
  }
  get reason(): ClosureReason {
    return this.props.reason;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  isFullDay(): boolean {
    return this.props.startTime === null;
  }

  /** True if this closure overlaps the given time window (or the given window is a full-day). */
  overlaps(otherStart: string | null, otherEnd: string | null): boolean {
    if (this.isFullDay() || otherStart === null) return true;
    return this.props.startTime! < otherEnd! && otherStart < this.props.endTime!;
  }

  static close(
    tenantId: string,
    date: string,
    reason: ClosureReason,
    createdBy: string,
    startTime?: string,
    endTime?: string,
    notes?: string,
  ): ScheduleClosure {
    ScheduleClosure.assertValid(tenantId, date, reason, createdBy, startTime, endTime);
    return new ScheduleClosure({
      id: uuidv7(),
      tenantId,
      date,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      reason,
      notes: notes?.trim() ?? null,
      createdBy,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ScheduleClosureProps): ScheduleClosure {
    return new ScheduleClosure(props);
  }

  private static assertValid(
    tenantId: string,
    date: string,
    reason: ClosureReason,
    createdBy: string,
    startTime?: string,
    endTime?: string,
  ): void {
    if (!tenantId) throw new BookingDomainError('tenantId is required');
    if (!createdBy) throw new BookingDomainError('createdBy is required');
    if (!Object.values(ClosureReason).includes(reason)) {
      throw new BookingDomainError(`Invalid closure reason: ${reason}`);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) throw new BookingDomainError('Cannot close a schedule for a past date');
    ScheduleClosure.assertTimeRange(startTime, endTime);
  }

  private static assertTimeRange(startTime?: string, endTime?: string): void {
    const hasStart = startTime !== undefined && startTime !== null;
    const hasEnd = endTime !== undefined && endTime !== null;
    if (hasStart !== hasEnd) {
      throw new BookingDomainError('startTime and endTime must both be provided or both omitted');
    }
    if (hasStart && hasEnd) {
      if (!/^\d{2}:\d{2}$/.test(startTime!) || !/^\d{2}:\d{2}$/.test(endTime!)) {
        throw new BookingDomainError('startTime and endTime must be in HH:MM format');
      }
      if (endTime! <= startTime!) {
        throw new BookingDomainError('endTime must be after startTime');
      }
    }
  }
}
