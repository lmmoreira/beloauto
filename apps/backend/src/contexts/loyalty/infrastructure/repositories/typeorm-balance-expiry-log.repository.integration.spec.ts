import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { BalanceExpiryLogEntity } from '../entities/balance-expiry-log.entity';
import { TypeOrmBalanceExpiryLogRepository } from './typeorm-balance-expiry-log.repository';

describe('TypeOrmBalanceExpiryLogRepository (integration)', () => {
  let repo: TypeOrmBalanceExpiryLogRepository;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [BalanceExpiryLogEntity],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([BalanceExpiryLogEntity]),
      ],
      providers: [TypeOrmBalanceExpiryLogRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmBalanceExpiryLogRepository);
    ds = moduleRef.get(DataSource);

    await ds.query(`CREATE SCHEMA IF NOT EXISTS "loyalty"`);
    await ds.query(`
      CREATE TABLE IF NOT EXISTS "loyalty"."balance_expiry_log" (
        "entry_id"     UUID        NOT NULL,
        "processed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_balance_expiry_log_integ" PRIMARY KEY ("entry_id")
      )
    `);
  });

  afterAll(async () => {
    await ds.query(`DROP TABLE IF EXISTS "loyalty"."balance_expiry_log"`);
    await ds.destroy();
  });

  afterEach(async () => {
    await ds.query(`DELETE FROM "loyalty"."balance_expiry_log"`);
  });

  it('hasBeenProcessed returns false for unknown entryId', async () => {
    expect(await repo.hasBeenProcessed(uuidv7())).toBe(false);
  });

  it('markProcessed then hasBeenProcessed returns true', async () => {
    const entryId = uuidv7();
    await repo.markProcessed(entryId);
    expect(await repo.hasBeenProcessed(entryId)).toBe(true);
  });

  it('marking same entryId twice does not throw (idempotent)', async () => {
    const entryId = uuidv7();
    await repo.markProcessed(entryId);
    await expect(repo.markProcessed(entryId)).resolves.not.toThrow();
  });
});
