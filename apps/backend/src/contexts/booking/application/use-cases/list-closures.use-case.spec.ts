import { InMemoryScheduleClosureRepository } from '../../../../test/repositories/booking/in-memory-schedule-closure.repository';
import { ScheduleClosureBuilder } from '../../../../test/builders/booking/index';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { ListClosuresUseCase } from './list-closures.use-case';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const OTHER_TENANT = '99999999-0000-7000-8000-000000000099';

function makeUseCase(repo = new InMemoryScheduleClosureRepository()) {
  const ctx = new TenantContextBuilder().withTenantId(TENANT_ID).build();
  return { uc: new ListClosuresUseCase(repo, ctx), repo };
}

describe('ListClosuresUseCase', () => {
  it('returns closures in the requested date range sorted by date', async () => {
    const { uc, repo } = makeUseCase();
    await repo.save(
      new ScheduleClosureBuilder().withTenantId(TENANT_ID).withDate('2026-12-25').build(),
    );
    await repo.save(
      new ScheduleClosureBuilder().withTenantId(TENANT_ID).withDate('2026-12-20').build(),
    );

    const { items } = await uc.execute({ from: '2026-12-01', to: '2026-12-31' });

    expect(items).toHaveLength(2);
    expect(items[0].date).toBe('2026-12-20');
    expect(items[1].date).toBe('2026-12-25');
  });

  it('returns empty list when no closures in range', async () => {
    const { uc } = makeUseCase();
    const { items } = await uc.execute({ from: '2026-11-01', to: '2026-11-30' });
    expect(items).toHaveLength(0);
  });

  it('does not return closures outside the date range', async () => {
    const { uc, repo } = makeUseCase();
    await repo.save(
      new ScheduleClosureBuilder().withTenantId(TENANT_ID).withDate('2026-12-25').build(),
    );

    const { items } = await uc.execute({ from: '2026-11-01', to: '2026-11-30' });
    expect(items).toHaveLength(0);
  });

  it('does not return closures from another tenant', async () => {
    const { uc, repo } = makeUseCase();
    await repo.save(
      new ScheduleClosureBuilder().withTenantId(OTHER_TENANT).withDate('2026-12-25').build(),
    );

    const { items } = await uc.execute({ from: '2026-12-01', to: '2026-12-31' });
    expect(items).toHaveLength(0);
  });

  it('serializes startTime/endTime as strings when partial closure', async () => {
    const { uc, repo } = makeUseCase();
    await repo.save(
      new ScheduleClosureBuilder()
        .withTenantId(TENANT_ID)
        .withDate('2026-12-25')
        .withStartTime('10:00')
        .withEndTime('12:00')
        .build(),
    );

    const { items } = await uc.execute({ from: '2026-12-01', to: '2026-12-31' });
    expect(items[0].startTime).toBe('10:00');
    expect(items[0].endTime).toBe('12:00');
  });

  it('serializes startTime/endTime as null for full-day closure', async () => {
    const { uc, repo } = makeUseCase();
    await repo.save(
      new ScheduleClosureBuilder().withTenantId(TENANT_ID).withDate('2026-12-25').build(),
    );

    const { items } = await uc.execute({ from: '2026-12-01', to: '2026-12-31' });
    expect(items[0].startTime).toBeNull();
    expect(items[0].endTime).toBeNull();
  });
});
