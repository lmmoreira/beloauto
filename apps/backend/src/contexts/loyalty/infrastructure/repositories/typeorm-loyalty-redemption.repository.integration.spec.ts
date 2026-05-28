import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LoyaltyRedemptionBuilder } from '../../../../test/builders/loyalty/index';
import { LoyaltyRedemption } from '../../domain/loyalty-redemption.aggregate';
import { LoyaltyRedemptionEntity } from '../entities/loyalty-redemption.entity';
import { TypeOrmLoyaltyRedemptionRepository } from './typeorm-loyalty-redemption.repository';

const TENANT_A = '10000000-0000-7000-8000-000000000001';
const TENANT_B = '20000000-0000-7000-8000-000000000002';
const CUSTOMER_1 = '00000000-0000-7000-8000-100000000001';

describe('TypeOrmLoyaltyRedemptionRepository (integration)', () => {
  let repo: TypeOrmLoyaltyRedemptionRepository;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [LoyaltyRedemptionEntity],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([LoyaltyRedemptionEntity]),
      ],
      providers: [TypeOrmLoyaltyRedemptionRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmLoyaltyRedemptionRepository);
    ds = moduleRef.get(DataSource);

    await ds.query(`CREATE SCHEMA IF NOT EXISTS "loyalty"`);
    await ds.query(`
      CREATE TABLE IF NOT EXISTS "loyalty"."loyalty_redemptions" (
        "id"              UUID        NOT NULL,
        "tenant_id"       UUID        NOT NULL,
        "customer_id"     UUID        NOT NULL,
        "points_redeemed" INTEGER     NOT NULL CHECK (points_redeemed > 0),
        "redeemed_by"     UUID        NOT NULL,
        "notes"           TEXT,
        "booking_id"      UUID,
        "redeemed_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loyalty_redemptions_integ" PRIMARY KEY ("id")
      )
    `);
    await ds.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loyalty_redemptions_tc_integ"
        ON "loyalty"."loyalty_redemptions" ("tenant_id", "customer_id")
    `);
  });

  afterAll(async () => {
    await ds.query(`DROP TABLE IF EXISTS "loyalty"."loyalty_redemptions"`);
    await ds.destroy();
  });

  afterEach(async () => {
    await ds.query(`DELETE FROM "loyalty"."loyalty_redemptions"`);
  });

  describe('save()', () => {
    it('persists a redemption row', async () => {
      const redemption = new LoyaltyRedemptionBuilder()
        .withTenantId(TENANT_A)
        .withCustomerId(CUSTOMER_1)
        .withPointsRedeemed(20)
        .build();

      await repo.save(redemption);

      const result = await repo.findByCustomer(TENANT_A, CUSTOMER_1, 1, 20);
      expect(result.total).toBe(1);
      expect(result.items[0]).toBeInstanceOf(LoyaltyRedemption);
      expect(result.items[0].pointsRedeemed).toBe(20);
    });

    it('stores optional notes and bookingId correctly', async () => {
      const redemption = new LoyaltyRedemptionBuilder()
        .withTenantId(TENANT_A)
        .withCustomerId(CUSTOMER_1)
        .withNotes('Free wash')
        .withBookingId('00000000-0000-7000-8000-000000000099')
        .build();

      await repo.save(redemption);

      const result = await repo.findByCustomer(TENANT_A, CUSTOMER_1, 1, 20);
      expect(result.items[0].notes).toBe('Free wash');
      expect(result.items[0].bookingId).toBe('00000000-0000-7000-8000-000000000099');
    });
  });

  describe('findByCustomer()', () => {
    it('paginates results correctly', async () => {
      for (let i = 0; i < 3; i++) {
        await repo.save(
          new LoyaltyRedemptionBuilder()
            .withTenantId(TENANT_A)
            .withCustomerId(CUSTOMER_1)
            .withPointsRedeemed(10)
            .build(),
        );
      }

      const page1 = await repo.findByCustomer(TENANT_A, CUSTOMER_1, 1, 2);
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = await repo.findByCustomer(TENANT_A, CUSTOMER_1, 2, 2);
      expect(page2.items).toHaveLength(1);
    });
  });

  describe('tenant isolation', () => {
    it('findByCustomer with Tenant B id returns empty for Tenant A customer', async () => {
      await repo.save(
        new LoyaltyRedemptionBuilder()
          .withTenantId(TENANT_A)
          .withCustomerId(CUSTOMER_1)
          .withPointsRedeemed(10)
          .build(),
      );

      const result = await repo.findByCustomer(TENANT_B, CUSTOMER_1, 1, 20);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
