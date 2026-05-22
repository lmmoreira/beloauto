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
import { addDays, nextWeekday, pastDate } from '../../../../test/utils/date-helpers';
import { TenantEntity } from '../../../platform/infrastructure/entities/tenant.entity';
import { ScheduleClosureEntity } from '../entities/schedule-closure.entity';
import { ScheduleOpeningEntity } from '../entities/schedule-opening.entity';
import { ServiceEntity } from '../entities/service.entity';
import { BookingModule } from '../../booking.module';

// Isolated tenant IDs.
const TENANT_A = '10000000-0000-4000-8000-000000000600';
const TENANT_B = '10000000-0000-4000-8000-000000000601';

function tenantHeader(tenantId: string): Record<string, string> {
  return { 'x-tenant-id': tenantId, 'x-correlation-id': 'test-correlation-id' };
}

describe('ScheduleAvailabilitySummaryController (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let serviceId: string;

  // Monday of a week well in the future — used as the anchor for range tests.
  const RANGE_START = nextWeekday(1, 4); // 4 weeks from now, Monday
  const RANGE_END = addDays(RANGE_START, 6); // Sunday of the same week

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

    const tenantRepo = ds.getRepository(TenantEntity);
    await tenantRepo.save(
      new TenantEntityBuilder().withId(TENANT_A).withSlug('summary-tenant-a-600').build(),
    );
    await tenantRepo.save(
      new TenantEntityBuilder().withId(TENANT_B).withSlug('summary-tenant-b-601').build(),
    );

    const svc = new ServiceEntityBuilder().withTenantId(TENANT_A).withDurationMinutes(30).build();
    await ds.getRepository(ServiceEntity).save(svc);
    serviceId = svc.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────────

  describe('GET /schedule/availability/summary — happy path', () => {
    it('returns one entry per day for a 7-day range', async () => {
      const { body } = await request(app.getHttpServer())
        .get(
          `/schedule/availability/summary?from=${RANGE_START}&to=${RANGE_END}&serviceIds=${serviceId}`,
        )
        .set(tenantHeader(TENANT_A))
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(7);

      // Each entry must have the correct shape.
      for (const entry of body as { date: string; available: boolean; slotCount: number }[]) {
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof entry.available).toBe('boolean');
        expect(typeof entry.slotCount).toBe('number');
      }
    });

    it('Mon–Sat entries are available; Sunday entry is not (default business_hours)', async () => {
      const { body } = await request(app.getHttpServer())
        .get(
          `/schedule/availability/summary?from=${RANGE_START}&to=${RANGE_END}&serviceIds=${serviceId}`,
        )
        .set(tenantHeader(TENANT_A))
        .expect(200);

      const sunday = body.find((e: { date: string }) => e.date === RANGE_END);
      expect(sunday).toBeDefined();
      expect(sunday.available).toBe(false);
      expect(sunday.slotCount).toBe(0);

      // Monday (RANGE_START) must be open.
      const monday = body.find((e: { date: string }) => e.date === RANGE_START);
      expect(monday).toBeDefined();
      expect(monday.available).toBe(true);
      expect(monday.slotCount).toBeGreaterThan(0);
    });
  });

  // ─── Closure and opening scenarios ───────────────────────────────────────────

  describe('GET /schedule/availability/summary — closures and openings', () => {
    it('day with a full-day closure returns available:false and slotCount:0', async () => {
      const CLOSURE_TENANT = '10000000-0000-4000-8000-000000000610';
      await ds
        .getRepository(TenantEntity)
        .save(
          new TenantEntityBuilder()
            .withId(CLOSURE_TENANT)
            .withSlug('summary-closure-tenant-610')
            .build(),
        );
      const svc = new ServiceEntityBuilder()
        .withTenantId(CLOSURE_TENANT)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(svc);

      // Close Tuesday (day 1 in the range = RANGE_START + 1).
      const tuesday = addDays(RANGE_START, 1);
      await ds
        .getRepository(ScheduleClosureEntity)
        .save(
          new ScheduleClosureEntityBuilder().withTenantId(CLOSURE_TENANT).withDate(tuesday).build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(
          `/schedule/availability/summary?from=${RANGE_START}&to=${RANGE_END}&serviceIds=${svc.id}`,
        )
        .set(tenantHeader(CLOSURE_TENANT))
        .expect(200);

      const tuesdayEntry = (body as { date: string; available: boolean; slotCount: number }[]).find(
        (e) => e.date === tuesday,
      );
      expect(tuesdayEntry).toBeDefined();
      expect(tuesdayEntry!.available).toBe(false);
      expect(tuesdayEntry!.slotCount).toBe(0);
    });

    it('Sunday with a ScheduleOpening returns available:true', async () => {
      const OPENING_TENANT = '10000000-0000-4000-8000-000000000611';
      await ds
        .getRepository(TenantEntity)
        .save(
          new TenantEntityBuilder()
            .withId(OPENING_TENANT)
            .withSlug('summary-opening-tenant-611')
            .build(),
        );
      const svc = new ServiceEntityBuilder()
        .withTenantId(OPENING_TENANT)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(svc);
      await ds.getRepository(ScheduleOpeningEntity).save(
        new ScheduleOpeningEntityBuilder()
          .withTenantId(OPENING_TENANT)
          .withDate(RANGE_END) // Sunday
          .withStartTime('09:00')
          .withEndTime('14:00')
          .build(),
      );

      const { body } = await request(app.getHttpServer())
        .get(
          `/schedule/availability/summary?from=${RANGE_START}&to=${RANGE_END}&serviceIds=${svc.id}`,
        )
        .set(tenantHeader(OPENING_TENANT))
        .expect(200);

      const sundayEntry = (body as { date: string; available: boolean; slotCount: number }[]).find(
        (e) => e.date === RANGE_END,
      );
      expect(sundayEntry).toBeDefined();
      expect(sundayEntry!.available).toBe(true);
      expect(sundayEntry!.slotCount).toBeGreaterThan(0);
    });

    it('past dates in range return available:false without error', async () => {
      // Use a range entirely in the past (the use case marks any date < today as unavailable).
      const from = pastDate(7);
      const to = pastDate(2);

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability/summary?from=${from}&to=${to}&serviceIds=${serviceId}`)
        .set(tenantHeader(TENANT_A))
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect((body as unknown[]).length).toBeGreaterThan(0);
      for (const entry of body as { available: boolean }[]) {
        expect(entry.available).toBe(false);
      }
    });
  });

  // ─── Validation errors ────────────────────────────────────────────────────────

  describe('GET /schedule/availability/summary — validation errors', () => {
    it('returns 422 when from > to', async () => {
      const { body } = await request(app.getHttpServer())
        .get(
          `/schedule/availability/summary?from=${RANGE_END}&to=${RANGE_START}&serviceIds=${serviceId}`,
        )
        .set(tenantHeader(TENANT_A))
        .expect(422);

      expect(body.status).toBe(422);
    });

    it('returns 422 when range exceeds 90 days', async () => {
      const from = RANGE_START;
      const to = addDays(RANGE_START, 91);

      const { body } = await request(app.getHttpServer())
        .get(`/schedule/availability/summary?from=${from}&to=${to}&serviceIds=${serviceId}`)
        .set(tenantHeader(TENANT_A))
        .expect(422);

      expect(body.status).toBe(422);
    });

    it('returns 400 for an unknown service ID', async () => {
      const unknownId = '00000000-0000-4000-8000-000000000099';

      const { body } = await request(app.getHttpServer())
        .get(
          `/schedule/availability/summary?from=${RANGE_START}&to=${RANGE_END}&serviceIds=${unknownId}`,
        )
        .set(tenantHeader(TENANT_A))
        .expect(400);

      expect(body.status).toBe(400);
    });

    it('returns 400 when X-Tenant-ID header is missing', async () => {
      const { body } = await request(app.getHttpServer())
        .get(
          `/schedule/availability/summary?from=${RANGE_START}&to=${RANGE_END}&serviceIds=${serviceId}`,
        )
        .expect(400);

      expect(body.status).toBe(400);
    });
  });

  // ─── Tenant isolation ─────────────────────────────────────────────────────────

  describe('GET /schedule/availability/summary — tenant isolation', () => {
    it("Tenant B's closure does not affect Tenant A's summary", async () => {
      // Add a full-day closure for TENANT_B on Monday of the test week.
      const isolationTenantB = '10000000-0000-4000-8000-000000000602';
      await ds
        .getRepository(TenantEntity)
        .save(
          new TenantEntityBuilder()
            .withId(isolationTenantB)
            .withSlug('summary-isolation-tenant-b-602')
            .build(),
        );
      const tenantBSvc = new ServiceEntityBuilder()
        .withTenantId(isolationTenantB)
        .withDurationMinutes(30)
        .build();
      await ds.getRepository(ServiceEntity).save(tenantBSvc);
      await ds
        .getRepository(ScheduleClosureEntity)
        .save(
          new ScheduleClosureEntityBuilder()
            .withTenantId(isolationTenantB)
            .withDate(RANGE_START)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(
          `/schedule/availability/summary?from=${RANGE_START}&to=${RANGE_END}&serviceIds=${serviceId}`,
        )
        .set(tenantHeader(TENANT_A))
        .expect(200);

      const mondayEntry = (body as { date: string; available: boolean; slotCount: number }[]).find(
        (e) => e.date === RANGE_START,
      );
      expect(mondayEntry).toBeDefined();
      // TENANT_A has no closure on this Monday — must be available.
      expect(mondayEntry!.available).toBe(true);
      expect(mondayEntry!.slotCount).toBeGreaterThan(0);
    });
  });
});
