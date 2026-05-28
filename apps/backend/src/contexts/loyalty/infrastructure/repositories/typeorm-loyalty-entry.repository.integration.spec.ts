import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { LoyaltyEntryBuilder } from '../../../../test/builders/loyalty/index';
import { LoyaltyEntry } from '../../domain/loyalty-entry.aggregate';
import { LoyaltyEntryEntity } from '../entities/loyalty-entry.entity';
import { TypeOrmLoyaltyEntryRepository } from './typeorm-loyalty-entry.repository';

const TENANT_A = '10000000-0000-7000-8000-000000000001';
const TENANT_B = '20000000-0000-7000-8000-000000000002';

describe('TypeOrmLoyaltyEntryRepository (integration)', () => {
  let repo: TypeOrmLoyaltyEntryRepository;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [LoyaltyEntryEntity],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([LoyaltyEntryEntity]),
      ],
      providers: [TypeOrmLoyaltyEntryRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmLoyaltyEntryRepository);
    ds = moduleRef.get(DataSource);

    await ds.query(`CREATE SCHEMA IF NOT EXISTS "loyalty"`);
    await ds.query(`
      CREATE TABLE IF NOT EXISTS "loyalty"."loyalty_entries" (
        "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"        UUID        NOT NULL,
        "customer_id"      UUID        NOT NULL,
        "booking_id"       UUID        NOT NULL,
        "booking_line_id"  UUID        NOT NULL,
        "service_id"       UUID        NOT NULL,
        "points"           INTEGER     NOT NULL CHECK (points > 0),
        "earned_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at"       TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_loyalty_entries_integ" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_loyalty_entries_tenant_booking_line_integ"
          UNIQUE ("tenant_id", "booking_line_id")
      )
    `);
  });

  afterAll(async () => {
    await ds.query(`DROP TABLE IF EXISTS "loyalty"."loyalty_entries"`);
    await ds.destroy();
  });

  afterEach(async () => {
    await ds.query(`DELETE FROM "loyalty"."loyalty_entries"`);
  });

  describe('save() + findActiveByCustomer()', () => {
    it('persists an entry and returns it as active', async () => {
      const customerId = uuidv7();
      const entry = new LoyaltyEntryBuilder()
        .withTenantId(TENANT_A)
        .withCustomerId(customerId)
        .withPoints(15)
        .withExpiresAt(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
        .build();

      await repo.save(entry);

      const found = await repo.findActiveByCustomer(TENANT_A, customerId);
      expect(found).toHaveLength(1);
      expect(found[0]).toBeInstanceOf(LoyaltyEntry);
      expect(found[0].points).toBe(15);
      expect(found[0].customerId).toBe(customerId);
    });

    it('does not return expired entries in findActiveByCustomer', async () => {
      const customerId = uuidv7();
      const expiredEntry = new LoyaltyEntryBuilder()
        .withTenantId(TENANT_A)
        .withCustomerId(customerId)
        .withPoints(10)
        .withExpiresAt(new Date(Date.now() - 1000))
        .build();

      await repo.save(expiredEntry);

      const found = await repo.findActiveByCustomer(TENANT_A, customerId);
      expect(found).toHaveLength(0);
    });
  });

  describe('calculateActiveBalance()', () => {
    it('returns sum of active entry points', async () => {
      const customerId = uuidv7();
      const futureExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await repo.save(
        new LoyaltyEntryBuilder()
          .withTenantId(TENANT_A)
          .withCustomerId(customerId)
          .withPoints(10)
          .withExpiresAt(futureExpiry)
          .build(),
      );
      await repo.save(
        new LoyaltyEntryBuilder()
          .withTenantId(TENANT_A)
          .withCustomerId(customerId)
          .withPoints(20)
          .withExpiresAt(futureExpiry)
          .build(),
      );

      const balance = await repo.calculateActiveBalance(TENANT_A, customerId);
      expect(balance).toBe(30);
    });

    it('returns 0 when all entries are expired', async () => {
      const customerId = uuidv7();
      const pastExpiry = new Date(Date.now() - 1000);

      await repo.save(
        new LoyaltyEntryBuilder()
          .withTenantId(TENANT_A)
          .withCustomerId(customerId)
          .withPoints(10)
          .withExpiresAt(pastExpiry)
          .build(),
      );

      const balance = await repo.calculateActiveBalance(TENANT_A, customerId);
      expect(balance).toBe(0);
    });

    it('returns 0 when customer has no entries', async () => {
      const balance = await repo.calculateActiveBalance(TENANT_A, uuidv7());
      expect(balance).toBe(0);
    });
  });

  describe('idempotency', () => {
    it('throws on duplicate (tenant_id, booking_line_id)', async () => {
      const bookingLineId = uuidv7();
      const customerId = uuidv7();

      const first = new LoyaltyEntryBuilder()
        .withTenantId(TENANT_A)
        .withCustomerId(customerId)
        .withBookingLineId(bookingLineId)
        .build();
      const duplicate = new LoyaltyEntryBuilder()
        .withTenantId(TENANT_A)
        .withCustomerId(customerId)
        .withBookingLineId(bookingLineId)
        .build();

      await repo.save(first);
      await expect(repo.save(duplicate)).rejects.toThrow();
    });
  });

  describe('tenant isolation', () => {
    it('findActiveByCustomer scoped to tenant — returns [] for wrong tenant', async () => {
      const customerId = uuidv7();
      const futureExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await repo.save(
        new LoyaltyEntryBuilder()
          .withTenantId(TENANT_A)
          .withCustomerId(customerId)
          .withPoints(10)
          .withExpiresAt(futureExpiry)
          .build(),
      );

      const foundB = await repo.findActiveByCustomer(TENANT_B, customerId);
      expect(foundB).toHaveLength(0);
    });

    it('calculateActiveBalance returns 0 for wrong tenant', async () => {
      const customerId = uuidv7();
      const futureExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await repo.save(
        new LoyaltyEntryBuilder()
          .withTenantId(TENANT_A)
          .withCustomerId(customerId)
          .withPoints(50)
          .withExpiresAt(futureExpiry)
          .build(),
      );

      const balanceB = await repo.calculateActiveBalance(TENANT_B, customerId);
      expect(balanceB).toBe(0);
    });
  });

  describe('findExpiringBefore()', () => {
    it('returns entries expiring before the given date', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      const futureExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await repo.save(
        new LoyaltyEntryBuilder().withTenantId(TENANT_A).withExpiresAt(pastExpiry).build(),
      );
      await repo.save(
        new LoyaltyEntryBuilder().withTenantId(TENANT_A).withExpiresAt(futureExpiry).build(),
      );

      const expiring = await repo.findExpiringBefore(new Date());
      expect(expiring.length).toBeGreaterThanOrEqual(1);
      expect(expiring.every((e) => e.expiresAt < new Date())).toBe(true);
    });
  });
});
