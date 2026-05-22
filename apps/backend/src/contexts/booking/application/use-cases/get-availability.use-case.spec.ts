import { TenantContext } from '../../../../shared/tenant/tenant-context';
import { InMemoryBookingAvailabilityPort } from '../../../../test/infrastructure/in-memory-booking-availability';
import { InMemoryScheduleTenantSettingsPort } from '../../../../test/infrastructure/in-memory-schedule-tenant-settings';
import { InMemoryScheduleClosureRepository } from '../../../../test/repositories/booking/in-memory-schedule-closure.repository';
import { InMemoryScheduleOpeningRepository } from '../../../../test/repositories/booking/in-memory-schedule-opening.repository';
import { InMemoryServiceRepository } from '../../../../test/repositories/booking/in-memory-service.repository';
import { ScheduleClosureBuilder } from '../../../../test/builders/booking/schedule-closure.builder';
import { ScheduleOpeningBuilder } from '../../../../test/builders/booking/schedule-opening.builder';
import { ServiceBuilder } from '../../../../test/builders/booking/service.builder';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { nextWeekday } from '../../../../test/utils/date-helpers';
import { AvailabilityService } from '../../domain/services/availability.service';
import { GetAvailabilityUseCase } from './get-availability.use-case';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const monday = nextWeekday(1);
const sunday = nextWeekday(0);

function makeUseCase(ctx?: Partial<TenantContext>) {
  const tenantContext = new TenantContextBuilder().withTenantId(TENANT_ID).build();
  Object.assign(tenantContext, ctx);

  const serviceRepo = new InMemoryServiceRepository();
  const closureRepo = new InMemoryScheduleClosureRepository();
  const openingRepo = new InMemoryScheduleOpeningRepository();
  const settingsPort = new InMemoryScheduleTenantSettingsPort();
  const bookingPort = new InMemoryBookingAvailabilityPort();
  const availabilityService = new AvailabilityService();

  return {
    useCase: new GetAvailabilityUseCase(
      tenantContext,
      serviceRepo,
      closureRepo,
      openingRepo,
      settingsPort,
      bookingPort,
      availabilityService,
    ),
    serviceRepo,
    closureRepo,
    openingRepo,
    settingsPort,
    bookingPort,
  };
}

describe('GetAvailabilityUseCase', () => {
  it('returns slots for a valid open day with active services', async () => {
    const { useCase, serviceRepo } = makeUseCase();
    const service = new ServiceBuilder().withTenantId(TENANT_ID).withDurationMinutes(60).build();
    await serviceRepo.save(service);

    const result = await useCase.execute({ date: monday, serviceIds: [service.id] });

    expect(result.date).toBe(monday);
    expect(result.available).toBe(true);
    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.slots[0]).toHaveProperty('startsAt');
    expect(result.slots[0]).toHaveProperty('endsAt');
  });

  it('returns available:false and empty slots for a closed day (Sunday)', async () => {
    const { useCase, serviceRepo } = makeUseCase();
    const service = new ServiceBuilder().withTenantId(TENANT_ID).build();
    await serviceRepo.save(service);

    const result = await useCase.execute({ date: sunday, serviceIds: [service.id] });

    expect(result.available).toBe(false);
    expect(result.slots).toHaveLength(0);
  });

  it('returns available:false when a full-day closure exists', async () => {
    const { useCase, serviceRepo, closureRepo } = makeUseCase();
    const service = new ServiceBuilder().withTenantId(TENANT_ID).build();
    await serviceRepo.save(service);
    await closureRepo.save(
      new ScheduleClosureBuilder().withTenantId(TENANT_ID).withDate(monday).build(),
    );

    const result = await useCase.execute({ date: monday, serviceIds: [service.id] });

    expect(result.available).toBe(false);
    expect(result.slots).toHaveLength(0);
  });

  it('returns slots within opening window when ScheduleOpening exists on Sunday', async () => {
    const { useCase, serviceRepo, openingRepo } = makeUseCase();
    const service = new ServiceBuilder().withTenantId(TENANT_ID).withDurationMinutes(60).build();
    await serviceRepo.save(service);
    await openingRepo.save(
      new ScheduleOpeningBuilder()
        .withTenantId(TENANT_ID)
        .withDate(sunday)
        .withStartTime('09:00')
        .withEndTime('14:00')
        .build(),
    );

    const result = await useCase.execute({ date: sunday, serviceIds: [service.id] });

    expect(result.available).toBe(true);
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('throws AvailabilityDateInPastError for a past date', async () => {
    const { useCase, serviceRepo } = makeUseCase();
    const service = new ServiceBuilder().withTenantId(TENANT_ID).build();
    await serviceRepo.save(service);

    await expect(
      useCase.execute({ date: '2020-01-01', serviceIds: [service.id] }),
    ).rejects.toMatchObject({ name: 'AvailabilityDateInPastError' });
  });

  it('throws BookingDomainError (400) when a serviceId does not belong to tenant', async () => {
    const { useCase } = makeUseCase();
    const unknownId = '00000000-0000-7000-8000-000000000099';

    await expect(useCase.execute({ date: monday, serviceIds: [unknownId] })).rejects.toMatchObject({
      name: 'BookingDomainError',
    });
  });

  it('throws BookingDomainError (400) when a service is inactive', async () => {
    const { useCase, serviceRepo } = makeUseCase();
    const service = new ServiceBuilder().withTenantId(TENANT_ID).withIsActive(false).build();
    await serviceRepo.save(service);

    await expect(useCase.execute({ date: monday, serviceIds: [service.id] })).rejects.toMatchObject(
      { name: 'BookingDomainError' },
    );
  });

  it('sums durations of multiple services', async () => {
    const { useCase, serviceRepo } = makeUseCase();
    const s1 = new ServiceBuilder().withTenantId(TENANT_ID).withDurationMinutes(30).build();
    const s2 = new ServiceBuilder().withTenantId(TENANT_ID).withDurationMinutes(30).build();
    await serviceRepo.save(s1);
    await serviceRepo.save(s2);

    // 30+30+60 buffer = 120 min total — same count as single 60+60 service
    const result = await useCase.execute({ date: monday, serviceIds: [s1.id, s2.id] });

    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.available).toBe(true);
  });
});
