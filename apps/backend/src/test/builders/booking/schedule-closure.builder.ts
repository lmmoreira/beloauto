import {
  ClosureReason,
  ScheduleClosure,
} from '../../../contexts/booking/domain/schedule-closure.aggregate';

export class ScheduleClosureBuilder {
  private tenantId = '00000000-0000-7000-8000-000000000001';
  private date: string = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  private reason = ClosureReason.HOLIDAY;
  private createdBy = '00000000-0000-7000-8000-000000000002';
  private notes: string | undefined = undefined;

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withDate(date: string): this {
    this.date = date;
    return this;
  }

  withReason(reason: ClosureReason): this {
    this.reason = reason;
    return this;
  }

  withCreatedBy(createdBy: string): this {
    this.createdBy = createdBy;
    return this;
  }

  withNotes(notes: string): this {
    this.notes = notes;
    return this;
  }

  build(): ScheduleClosure {
    return ScheduleClosure.close(this.tenantId, this.date, this.reason, this.createdBy, this.notes);
  }
}
