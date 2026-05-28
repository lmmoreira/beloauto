import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LoyaltyBalance } from '../../domain/loyalty-balance.aggregate';
import { LoyaltyBalanceEntity } from '../entities/loyalty-balance.entity';
import { TypeOrmLoyaltyBalanceRepository } from './typeorm-loyalty-balance.repository';

const TENANT_A = '10000000-0000-7000-8000-000000000001';
const TENANT_B = '20000000-0000-7000-8000-000000000002';
const CUSTOMER_1 = '00000000-0000-7000-8000-100000000001';
const CUSTOMER_2 = '00000000-0000-7000-8000-100000000002';

describe('TypeOrmLoyaltyBalanceRepository (integration)', () => {
  let repo: TypeOrmLoyaltyBalanceRepository;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [LoyaltyBalanceEntity],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([LoyaltyBalanceEntity]),
      ],
      providers: [TypeOrmLoyaltyBalanceRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmLoyaltyBalanceRepository);
    ds = moduleRef.get(DataSource);

    await ds.query(`CREATE SCHEMA IF NOT EXISTS "loyalty"`);
    await ds.query(`
      CREATE TABLE IF NOT EXISTS "loyalty"."loyalty_balances" (
        "tenant_id"      UUID        NOT NULL,
        "customer_id"    UUID        NOT NULL,
        "current_points" INTEGER     NOT NULL DEFAULT 0 CHECK (current_points >= 0),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loyalty_balances_integ" PRIMARY KEY ("tenant_id", "customer_id")
      )
    `);
  });

  afterAll(async () => {
    await ds.query(`DROP TABLE IF EXISTS "loyalty"."loyalty_balances"`);
    await ds.destroy();
  });

  afterEach(async () => {
    await ds.query(`DELETE FROM "loyalty"."loyalty_balances"`);
  });

  describe('upsert() + findByCustomer()', () => {
    it('creates a new balance row on first upsert', async () => {
      const balance = LoyaltyBalance.create(TENANT_A, CUSTOMER_1);
      balance.increment(20);

      await repo.upsert(balance);

      const found = await repo.findByCustomer(TENANT_A, CUSTOMER_1);
      expect(found).not.toBeNull();
      expect(found!.currentPoints).toBe(20);
    });

    it('updates existing balance row on subsequent upsert', async () => {
      const balance = LoyaltyBalance.create(TENANT_A, CUSTOMER_1);
      balance.increment(10);
      await repo.upsert(balance);

      balance.increment(15);
      await repo.upsert(balance);

      const found = await repo.findByCustomer(TENANT_A, CUSTOMER_1);
      expect(found!.currentPoints).toBe(25);
    });

    it('returns null for unknown customer', async () => {
      const result = await repo.findByCustomer(TENANT_A, CUSTOMER_1);
      expect(result).toBeNull();
    });

    it('increment then decrement yields correct balance', async () => {
      const balance = LoyaltyBalance.create(TENANT_A, CUSTOMER_1);
      balance.increment(30);
      await repo.upsert(balance);

      const loaded = await repo.findByCustomer(TENANT_A, CUSTOMER_1);
      loaded!.decrement(10);
      await repo.upsert(loaded!);

      const final = await repo.findByCustomer(TENANT_A, CUSTOMER_1);
      expect(final!.currentPoints).toBe(20);
    });

    it('decrement below zero throws domain error before touching DB', async () => {
      const balance = LoyaltyBalance.create(TENANT_A, CUSTOMER_1);
      balance.increment(5);
      await repo.upsert(balance);

      const loaded = await repo.findByCustomer(TENANT_A, CUSTOMER_1);
      expect(() => loaded!.decrement(10)).toThrow();

      const unchanged = await repo.findByCustomer(TENANT_A, CUSTOMER_1);
      expect(unchanged!.currentPoints).toBe(5);
    });
  });

  describe('tenant isolation', () => {
    it('findByCustomer with Tenant B id returns null for Tenant A customer', async () => {
      const balance = LoyaltyBalance.create(TENANT_A, CUSTOMER_1);
      balance.increment(50);
      await repo.upsert(balance);

      const result = await repo.findByCustomer(TENANT_B, CUSTOMER_1);
      expect(result).toBeNull();
    });

    it('two customers in same tenant have independent balances', async () => {
      const b1 = LoyaltyBalance.create(TENANT_A, CUSTOMER_1);
      b1.increment(10);
      const b2 = LoyaltyBalance.create(TENANT_A, CUSTOMER_2);
      b2.increment(40);

      await repo.upsert(b1);
      await repo.upsert(b2);

      const found1 = await repo.findByCustomer(TENANT_A, CUSTOMER_1);
      const found2 = await repo.findByCustomer(TENANT_A, CUSTOMER_2);

      expect(found1!.currentPoints).toBe(10);
      expect(found2!.currentPoints).toBe(40);
    });
  });
});
