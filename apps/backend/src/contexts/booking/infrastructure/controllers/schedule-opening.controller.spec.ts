import { HttpException } from '@nestjs/common';
import { futureDate, pastDate } from '../../../../test/utils/date-helpers';
import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryScheduleOpeningRepository } from '../../../../test/repositories/booking/in-memory-schedule-opening.repository';
import { ScheduleOpeningBuilder } from '../../../../test/builders/booking/schedule-opening.builder';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { IScheduleTenantSettingsPort } from '../../application/ports/schedule-tenant-settings.port';
import { OpenScheduleUseCase } from '../../application/use-cases/open-schedule.use-case';
import { ListOpeningsUseCase } from '../../application/use-cases/list-openings.use-case';
import { RemoveScheduleOpeningUseCase } from '../../application/use-cases/remove-schedule-opening.use-case';
import { ScheduleOpeningController } from './schedule-opening.controller';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const ACTOR_ID = '00000000-0000-7000-8000-000000000002';

const makeSettingsPort = (): IScheduleTenantSettingsPort => ({
  getBusinessHours: jest.fn().mockResolvedValue({
    timezone: 'America/Sao_Paulo',
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: { open: '09:00', close: '17:00' },
    sunday: null,
  }),
});

// Returns the next Sunday (UTC) at least 1 day in the future
function nextSunday(): string {
  const d = new Date();
  const daysUntilSunday = (7 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  return d.toISOString().slice(0, 10);
}

// Returns the next Monday (UTC) at least 1 day in the future
function nextMonday(): string {
  const d = new Date();
  const daysUntilMonday = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

describe('ScheduleOpeningController', () => {
  let repo: InMemoryScheduleOpeningRepository;
  let controller: ScheduleOpeningController;

  beforeEach(() => {
    repo = new InMemoryScheduleOpeningRepository();
    const ctx = new TenantContextBuilder().withTenantId(TENANT_ID).withActorId(ACTOR_ID).build();
    const tx = new InMemoryTransactionManager();
    const settingsPort = makeSettingsPort();
    controller = new ScheduleOpeningController(
      new OpenScheduleUseCase(repo, settingsPort, tx, ctx),
      new RemoveScheduleOpeningUseCase(repo, tx, ctx),
      new ListOpeningsUseCase(repo, ctx),
    );
  });

  describe('create()', () => {
    it('returns 201 result for a normally-closed day', async () => {
      const date = nextSunday();
      const result = await controller.create({ date, startTime: '09:00', endTime: '14:00' });

      expect(result.id).toBeDefined();
      expect(result.date).toBe(date);
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('14:00');
    });

    it('maps OpeningDateInPastError to 422', async () => {
      const err = await controller
        .create({ date: pastDate(1), startTime: '09:00', endTime: '14:00' })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(422);
    });

    it('maps DayAlreadyOpenInSettingsError to 422', async () => {
      const err = await controller
        .create({ date: nextMonday(), startTime: '09:00', endTime: '14:00' })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(422);
    });

    it('maps ScheduleOpeningAlreadyExistsError to 409', async () => {
      const date = nextSunday();
      await repo.save(new ScheduleOpeningBuilder().withTenantId(TENANT_ID).withDate(date).build());

      const err = await controller
        .create({ date, startTime: '09:00', endTime: '14:00' })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(409);
    });
  });

  describe('remove()', () => {
    it('deletes an opening and returns void', async () => {
      const opening = new ScheduleOpeningBuilder()
        .withTenantId(TENANT_ID)
        .withDate(futureDate(5))
        .build();
      await repo.save(opening);

      const result = await controller.remove(opening.id);
      expect(result).toBeUndefined();
    });

    it('maps ScheduleOpeningNotFoundError to 404', async () => {
      const err = await controller
        .remove('00000000-0000-7000-8000-000000000099')
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });
  });

  describe('list()', () => {
    it('returns items in the requested range', async () => {
      await repo.save(
        new ScheduleOpeningBuilder().withTenantId(TENANT_ID).withDate('2026-12-28').build(),
      );

      const result = await controller.list({ from: '2026-12-01', to: '2026-12-31' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].date).toBe('2026-12-28');
    });

    it('returns empty list when no openings in range', async () => {
      const result = await controller.list({ from: '2026-11-01', to: '2026-11-30' });
      expect(result.items).toHaveLength(0);
    });
  });
});
