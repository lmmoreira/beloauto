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

  static close(
    tenantId: string,
    date: string,
    reason: ClosureReason,
    createdBy: string,
    notes?: string,
  ): ScheduleClosure {
    if (!tenantId) throw new BookingDomainError('tenantId is required');
    if (!createdBy) throw new BookingDomainError('createdBy is required');
    if (!Object.values(ClosureReason).includes(reason)) {
      throw new BookingDomainError(`Invalid closure reason: ${reason}`);
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      throw new BookingDomainError('Cannot close a schedule for a past date');
    }

    return new ScheduleClosure({
      id: uuidv7(),
      tenantId,
      date,
      reason,
      notes: notes?.trim() ?? null,
      createdBy,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ScheduleClosureProps): ScheduleClosure {
    return new ScheduleClosure(props);
  }
}
