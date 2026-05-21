import { futureDate, pastDate } from '../../../../test/utils/date-helpers';
import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryScheduleClosureRepository } from '../../../../test/repositories/booking/in-memory-schedule-closure.repository';
import { ScheduleClosureBuilder } from '../../../../test/builders/booking/index';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import {
  ClosureDateInPastError,
  ScheduleAlreadyClosedError,
} from '../../domain/errors/booking-domain.error';
import { ClosureReason } from '../../domain/schedule-closure.aggregate';
import { CloseScheduleUseCase } from './close-schedule.use-case';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const ACTOR_ID = '00000000-0000-7000-8000-000000000002';

function makeUseCase(repo = new InMemoryScheduleClosureRepository()) {
  const ctx = new TenantContextBuilder().withTenantId(TENANT_ID).withActorId(ACTOR_ID).build();
  const uc = new CloseScheduleUseCase(repo, new InMemoryTransactionManager(), ctx);
  return { uc, repo };
}

describe('CloseScheduleUseCase', () => {
  it('creates a full-day closure and returns the result', async () => {
    const { uc } = makeUseCase();
    const result = await uc.execute({
      date: futureDate(5),
      reason: ClosureReason.HOLIDAY,
    });

    expect(result.id).toBeDefined();
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
    expect(result.reason).toBe(ClosureReason.HOLIDAY);
    expect(result.createdBy).toBe(ACTOR_ID);
  });

  it('creates a partial closure with startTime and endTime', async () => {
    const { uc } = makeUseCase();
    const result = await uc.execute({
      date: futureDate(3),
      reason: ClosureReason.MAINTENANCE,
      startTime: '10:00',
      endTime: '12:00',
    });

    expect(result.startTime).toBe('10:00');
    expect(result.endTime).toBe('12:00');
  });

  it('throws ClosureDateInPastError for a past date', async () => {
    const { uc } = makeUseCase();
    await expect(uc.execute({ date: pastDate(1), reason: ClosureReason.HOLIDAY })).rejects.toThrow(
      ClosureDateInPastError,
    );
  });

  it('throws ScheduleAlreadyClosedError when full-day closure already exists', async () => {
    const { uc, repo } = makeUseCase();
    const date = futureDate(5);
    await repo.save(new ScheduleClosureBuilder().withTenantId(TENANT_ID).withDate(date).build());

    await expect(uc.execute({ date, reason: ClosureReason.HOLIDAY })).rejects.toThrow(
      ScheduleAlreadyClosedError,
    );
  });

  it('throws ScheduleAlreadyClosedError when overlapping partial closure exists', async () => {
    const { uc, repo } = makeUseCase();
    const date = futureDate(5);
    await repo.save(
      new ScheduleClosureBuilder()
        .withTenantId(TENANT_ID)
        .withDate(date)
        .withStartTime('10:00')
        .withEndTime('12:00')
        .build(),
    );

    await expect(
      uc.execute({ date, reason: ClosureReason.MAINTENANCE, startTime: '11:00', endTime: '13:00' }),
    ).rejects.toThrow(ScheduleAlreadyClosedError);
  });

  it('allows two non-overlapping partial closures on the same date', async () => {
    const { uc, repo } = makeUseCase();
    const date = futureDate(5);
    await repo.save(
      new ScheduleClosureBuilder()
        .withTenantId(TENANT_ID)
        .withDate(date)
        .withStartTime('08:00')
        .withEndTime('10:00')
        .build(),
    );

    const result = await uc.execute({
      date,
      reason: ClosureReason.MAINTENANCE,
      startTime: '14:00',
      endTime: '16:00',
    });

    expect(result.id).toBeDefined();
  });

  it('throws ScheduleAlreadyClosedError when adding partial closure on a full-day-closed date', async () => {
    const { uc, repo } = makeUseCase();
    const date = futureDate(5);
    await repo.save(new ScheduleClosureBuilder().withTenantId(TENANT_ID).withDate(date).build());

    await expect(
      uc.execute({ date, reason: ClosureReason.MAINTENANCE, startTime: '10:00', endTime: '12:00' }),
    ).rejects.toThrow(ScheduleAlreadyClosedError);
  });

  it('persists the closure to the repository', async () => {
    const { uc, repo } = makeUseCase();
    const date = futureDate(7);
    const result = await uc.execute({ date, reason: ClosureReason.STAFF_DAY_OFF });

    const stored = await repo.findById(result.id, TENANT_ID);
    expect(stored).not.toBeNull();
    expect(stored!.date).toBe(date);
  });

  it('does not check closures from another tenant', async () => {
    const { uc, repo } = makeUseCase();
    const date = futureDate(5);
    await repo.save(
      new ScheduleClosureBuilder()
        .withTenantId('99999999-0000-7000-8000-000000000099')
        .withDate(date)
        .build(),
    );

    const result = await uc.execute({ date, reason: ClosureReason.HOLIDAY });
    expect(result.id).toBeDefined();
  });
});
