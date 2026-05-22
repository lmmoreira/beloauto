import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TransactionManagerModule } from '../../../../shared/infrastructure/transaction-manager.module';
import { TenantInterceptor } from '../../../../shared/tenant/tenant.interceptor';
import { TenantModule } from '../../../../shared/tenant/tenant.module';
import {
  ScheduleClosureEntityBuilder,
  ScheduleOpeningEntityBuilder,
  ServiceEntityBuilder,
} from '../../../../test/builders/booking/index';
import { TenantEntityBuilder } from '../../../../test/builders/platform/tenant-entity.builder';
import { nextWeekday } from '../../../../test/utils/date-helpers';
import { TenantEntity } from '../../../platform/infrastructure/entities/tenant.entity';
import { ScheduleClosureEntity } from '../entities/schedule-closure.entity';
import { ScheduleOpeningEntity } from '../entities/schedule-opening.entity';
import { ServiceEntity } from '../entities/service.entity';
import { BookingModule } from '../../booking.module';

// Isolated tenant IDs — each group owns its own data space.
const TENANT_A = '10000000-0000-4000-8000-000000000500';
const TENANT_B = '10000000-0000-4000-8000-000000000501';

// UTC day-of-week constants (0=Sun, 1=Mon, …, 6=Sat).
const MONDAY = nextWeekday(1);
const SUNDAY = nextWeekday(0);

function tenantHeader(tenantId: string): Record<string, string> {
  return { 'x-tenant-id': tenantId, 'x-correlation-id': 'test-correlation-id' };
}

describe('ScheduleAvailabilityController (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let serviceId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [ServiceEntity, ScheduleClosureEntity, ScheduleOpeningEntity, TenantEntity],
          synchronize: false,
        }),
        TransactionManagerModule,
        TenantModule,
        BookingModule,
      ],
      providers: [{ provide: APP_INTERCEPTOR, useClass: TenantInterceptor }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    ds = moduleRef.get(DataSource);

    // Seed tenants (availability use case loads business_hours from DB via GetTenantByIdUseCase).
    const tenantRepo = ds.getRepository(TenantEntity);
    await tenantRepo.save(
      new TenantEntityBuilder().withId(TENANT_A).withSlug('avail-tenant-a-500').build(),
    );
    await tenantRepo.save(
      new TenantEntityBuilder().withId(TENANT_B).withSlug('avail-tenant-b-501').build(),
    );

    // Seed one active service for TENANT_A.
    const svc = new ServiceEntityBuilder().withTenantId(TENANT_A).withDurationMinutes(30).build();
    await ds.getRepository(ServiceEntity).save(svc);
    serviceId = svc.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────────

  describe('GET /schedule/availability — happy path', () => {
    it('returns available slots for an open weekday with no closures', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${MONDAY}&serviceIds=${serviceId}`)
        .set(tenantHeader(TENANT_A))
        .expect(200);

      expect(body.date).toBe(MONDAY);
      expect(body.available).toBe(true);
      expect(Array.isArray(body.slots)).toBe(true);
      expect(body.slots.length).toBeGreaterThan(0);
      // Each slot must carry an ISO-8601 startsAt and endsAt.
      expect(body.slots[0]).toMatchObject({
        startsAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        endsAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      });
    });

    it('returns empty slots for a normally-closed day (Sunday)', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${SUNDAY}&serviceIds=${serviceId}`)
        .set(tenantHeader(TENANT_A))
        .expect(200);

      expect(body.available).toBe(false);
      expect(body.slots).toHaveLength(0);
    });
  });

  // ─── Closure scenarios ────────────────────────────────────────────────────────

  describe('GET /schedule/availability — closure scenarios', () => {
    it('returns empty slots when a full-day closure exists', async () => {
      const CLOSURE_TENANT = '10000000-0000-4000-8000-000000000510';
      await ds
        .getRepository(TenantEntity)
        .save(
          new TenantEntityBuilder()
            .withId(CLOSURE_TENANT)
            .withSlug('avail-closure-tenant-510')
            .build(),
        );
      const svc = new ServiceEntityBuilder()
        .withTenantId(CLOSURE_TENANT)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(svc);
      await ds
        .getRepository(ScheduleClosureEntity)
        .save(
          new ScheduleClosureEntityBuilder().withTenantId(CLOSURE_TENANT).withDate(MONDAY).build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${MONDAY}&serviceIds=${svc.id}`)
        .set(tenantHeader(CLOSURE_TENANT))
        .expect(200);

      expect(body.available).toBe(false);
      expect(body.slots).toHaveLength(0);
    });

    it('blocks only the closure window for a partial closure', async () => {
      const PARTIAL_TENANT = '10000000-0000-4000-8000-000000000511';
      await ds
        .getRepository(TenantEntity)
        .save(
          new TenantEntityBuilder()
            .withId(PARTIAL_TENANT)
            .withSlug('avail-partial-tenant-511')
            .build(),
        );
      const svc = new ServiceEntityBuilder()
        .withTenantId(PARTIAL_TENANT)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(svc);

      // Partial closure 10:00-12:00. With 30 min service + 60 min buffer = 90 min total,
      // slots whose window overlaps [10:00, 12:00) are blocked; slots from 12:00 onward are free.
      await ds
        .getRepository(ScheduleClosureEntity)
        .save(
          new ScheduleClosureEntityBuilder()
            .withTenantId(PARTIAL_TENANT)
            .withDate(MONDAY)
            .withStartTime('10:00')
            .withEndTime('12:00')
            .build(),
        );

      const { body: withoutClosure } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${nextWeekday(2)}&serviceIds=${svc.id}`)
        .set(tenantHeader(PARTIAL_TENANT))
        .expect(200);

      const { body: withClosure } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${MONDAY}&serviceIds=${svc.id}`)
        .set(tenantHeader(PARTIAL_TENANT))
        .expect(200);

      // Partial closure reduces — but does not eliminate — available slots.
      expect(withClosure.available).toBe(true);
      expect(withClosure.slots.length).toBeGreaterThan(0);
      expect(withClosure.slots.length).toBeLessThan(withoutClosure.slots.length);
    });

    it('respects multiple partial closures on the same day', async () => {
      const MULTI_TENANT = '10000000-0000-4000-8000-000000000512';
      await ds
        .getRepository(TenantEntity)
        .save(
          new TenantEntityBuilder().withId(MULTI_TENANT).withSlug('avail-multi-tenant-512').build(),
        );
      const svc = new ServiceEntityBuilder()
        .withTenantId(MULTI_TENANT)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(svc);

      const closureDate = nextWeekday(2); // Tuesday
      await ds
        .getRepository(ScheduleClosureEntity)
        .save(
          new ScheduleClosureEntityBuilder()
            .withTenantId(MULTI_TENANT)
            .withDate(closureDate)
            .withStartTime('09:00')
            .withEndTime('12:00')
            .build(),
        );
      await ds
        .getRepository(ScheduleClosureEntity)
        .save(
          new ScheduleClosureEntityBuilder()
            .withTenantId(MULTI_TENANT)
            .withDate(closureDate)
            .withStartTime('14:00')
            .withEndTime('16:00')
            .build(),
        );

      const { body: noClosures } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${MONDAY}&serviceIds=${svc.id}`)
        .set(tenantHeader(MULTI_TENANT))
        .expect(200);

      const { body: twoClosures } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${closureDate}&serviceIds=${svc.id}`)
        .set(tenantHeader(MULTI_TENANT))
        .expect(200);

      expect(twoClosures.available).toBe(true);
      expect(twoClosures.slots.length).toBeLessThan(noClosures.slots.length);
    });
  });

  // ─── Opening scenarios ────────────────────────────────────────────────────────

  describe('GET /schedule/availability — opening scenarios', () => {
    it('returns slots for a normally-closed day that has a ScheduleOpening', async () => {
      const OPENING_TENANT = '10000000-0000-4000-8000-000000000520';
      await ds
        .getRepository(TenantEntity)
        .save(
          new TenantEntityBuilder()
            .withId(OPENING_TENANT)
            .withSlug('avail-opening-tenant-520')
            .build(),
        );
      const svc = new ServiceEntityBuilder()
        .withTenantId(OPENING_TENANT)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(svc);
      await ds
        .getRepository(ScheduleOpeningEntity)
        .save(
          new ScheduleOpeningEntityBuilder()
            .withTenantId(OPENING_TENANT)
            .withDate(SUNDAY)
            .withStartTime('09:00')
            .withEndTime('14:00')
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${SUNDAY}&serviceIds=${svc.id}`)
        .set(tenantHeader(OPENING_TENANT))
        .expect(200);

      expect(body.available).toBe(true);
      expect(body.slots.length).toBeGreaterThan(0);
    });

    it('opening overrides a full-day closure on the same date', async () => {
      const OVERRIDE_TENANT = '10000000-0000-4000-8000-000000000521';
      await ds
        .getRepository(TenantEntity)
        .save(
          new TenantEntityBuilder()
            .withId(OVERRIDE_TENANT)
            .withSlug('avail-override-tenant-521')
            .build(),
        );
      const svc = new ServiceEntityBuilder()
        .withTenantId(OVERRIDE_TENANT)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(svc);

      const openDate = nextWeekday(3); // Wednesday
      // Add a full-day closure AND a ScheduleOpening on the same date.
      await ds
        .getRepository(ScheduleClosureEntity)
        .save(
          new ScheduleClosureEntityBuilder()
            .withTenantId(OVERRIDE_TENANT)
            .withDate(openDate)
            .build(),
        );
      await ds
        .getRepository(ScheduleOpeningEntity)
        .save(
          new ScheduleOpeningEntityBuilder()
            .withTenantId(OVERRIDE_TENANT)
            .withDate(openDate)
            .withStartTime('10:00')
            .withEndTime('15:00')
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${openDate}&serviceIds=${svc.id}`)
        .set(tenantHeader(OVERRIDE_TENANT))
        .expect(200);

      // Opening wins — slots are available despite the full-day closure.
      expect(body.available).toBe(true);
      expect(body.slots.length).toBeGreaterThan(0);
    });
  });

  // ─── Error cases ──────────────────────────────────────────────────────────────

  describe('GET /schedule/availability — validation errors', () => {
    it('returns 422 for a past date', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const past = yesterday.toISOString().slice(0, 10);

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${past}&serviceIds=${serviceId}`)
        .set(tenantHeader(TENANT_A))
        .expect(422);

      expect(body.status).toBe(422);
    });

    it('returns 400 for a service that does not belong to the tenant', async () => {
      const tenantBSvc = new ServiceEntityBuilder()
        .withTenantId(TENANT_B)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(tenantBSvc);

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${MONDAY}&serviceIds=${tenantBSvc.id}`)
        .set(tenantHeader(TENANT_A))
        .expect(400);

      expect(body.status).toBe(400);
    });

    it('returns 400 for a deactivated service', async () => {
      const inactiveSvc = new ServiceEntityBuilder()
        .withTenantId(TENANT_A)
        .withIsActive(false)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(inactiveSvc);

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${MONDAY}&serviceIds=${inactiveSvc.id}`)
        .set(tenantHeader(TENANT_A))
        .expect(400);

      expect(body.status).toBe(400);
    });

    it('returns 400 when X-Tenant-ID header is missing', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${MONDAY}&serviceIds=${serviceId}`)
        .expect(400);

      expect(body.status).toBe(400);
    });
  });

  // ─── Tenant isolation ─────────────────────────────────────────────────────────

  describe('GET /schedule/availability — tenant isolation', () => {
    it("Tenant B's full-day closure does not affect Tenant A's availability", async () => {
      // Tenant B has a full-day closure on MONDAY; Tenant A has none.
      await ds
        .getRepository(ScheduleClosureEntity)
        .save(new ScheduleClosureEntityBuilder().withTenantId(TENANT_B).withDate(MONDAY).build());

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability?date=${MONDAY}&serviceIds=${serviceId}`)
        .set(tenantHeader(TENANT_A))
        .expect(200);

      expect(body.available).toBe(true);
      expect(body.slots.length).toBeGreaterThan(0);
    });
  });
});
