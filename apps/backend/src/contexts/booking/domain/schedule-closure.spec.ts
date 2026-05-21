import { BookingDomainError } from './errors/booking-domain.error';
import { ClosureReason, ScheduleClosure } from './schedule-closure.aggregate';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const STAFF_ID = '00000000-0000-7000-8000-000000000002';

function futureDate(daysAhead = 1): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function pastDate(daysAgo = 1): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

describe('ScheduleClosure.close()', () => {
  it('creates a closure with valid inputs', () => {
    const date = futureDate(5);
    const closure = ScheduleClosure.close(TENANT_ID, date, ClosureReason.HOLIDAY, STAFF_ID);

    expect(closure.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(closure.tenantId).toBe(TENANT_ID);
    expect(closure.date).toBe(date);
    expect(closure.reason).toBe(ClosureReason.HOLIDAY);
    expect(closure.notes).toBeNull();
    expect(closure.createdBy).toBe(STAFF_ID);
    expect(closure.createdAt).toBeInstanceOf(Date);
  });

  it('creates a closure with optional notes', () => {
    const closure = ScheduleClosure.close(
      TENANT_ID,
      futureDate(3),
      ClosureReason.MAINTENANCE,
      STAFF_ID,
      '  Manutenção preventiva  ',
    );

    expect(closure.notes).toBe('Manutenção preventiva');
  });

  it('throws when date is in the past', () => {
    expect(() =>
      ScheduleClosure.close(TENANT_ID, pastDate(1), ClosureReason.HOLIDAY, STAFF_ID),
    ).toThrow(BookingDomainError);
  });

  it('throws when date is in the past — error message is correct', () => {
    expect(() =>
      ScheduleClosure.close(TENANT_ID, pastDate(5), ClosureReason.HOLIDAY, STAFF_ID),
    ).toThrow('Cannot close a schedule for a past date');
  });

  it('allows closing today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const closure = ScheduleClosure.close(TENANT_ID, today, ClosureReason.STAFF_DAY_OFF, STAFF_ID);
    expect(closure.date).toBe(today);
  });

  it('throws when tenantId is empty', () => {
    expect(() => ScheduleClosure.close('', futureDate(), ClosureReason.HOLIDAY, STAFF_ID)).toThrow(
      BookingDomainError,
    );
  });

  it('throws when createdBy is empty', () => {
    expect(() => ScheduleClosure.close(TENANT_ID, futureDate(), ClosureReason.HOLIDAY, '')).toThrow(
      BookingDomainError,
    );
  });

  it('throws when reason is not valid', () => {
    expect(() =>
      ScheduleClosure.close(TENANT_ID, futureDate(), 'INVALID_REASON' as ClosureReason, STAFF_ID),
    ).toThrow(BookingDomainError);
  });

  it('accepts all valid ClosureReason values', () => {
    const date = futureDate(10);
    for (const reason of Object.values(ClosureReason)) {
      expect(() => ScheduleClosure.close(TENANT_ID, date, reason, STAFF_ID)).not.toThrow();
    }
  });
});

describe('ScheduleClosure.reconstitute()', () => {
  it('reconstitutes from persisted props without validation', () => {
    const props = {
      id: '00000000-0000-7000-8000-000000000099',
      tenantId: TENANT_ID,
      date: '2020-01-01',
      reason: ClosureReason.HOLIDAY,
      notes: null,
      createdBy: STAFF_ID,
      createdAt: new Date('2020-01-01T00:00:00Z'),
    };

    const closure = ScheduleClosure.reconstitute(props);
    expect(closure.id).toBe(props.id);
    expect(closure.date).toBe('2020-01-01');
    expect(closure.reason).toBe(ClosureReason.HOLIDAY);
  });
});
