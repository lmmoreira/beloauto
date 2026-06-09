import { DataSource } from 'typeorm';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { createTestDataSource } from '../../../../test/test-datasource';
import { LoyaltyEntryBuilder } from '../../../../test/builders/loyalty/index';
import { BalanceExpiryLogEntity } from '../entities/balance-expiry-log.entity';
import { LoyaltyEntryEntity } from '../entities/loyalty-entry.entity';
import { TypeOrmBalanceExpiryLogRepository } from './typeorm-balance-expiry-log.repository';
import { TypeOrmLoyaltyEntryRepository } from './typeorm-loyalty-entry.repository';

const EXPIRY_LOG_TEST_TENANT = '00000000-0000-7000-8000-000000000001';

describe('TypeOrmBalanceExpiryLogRepository (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmBalanceExpiryLogRepository;
  let entryRepo: TypeOrmLoyaltyEntryRepository;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    repo = new TypeOrmBalanceExpiryLogRepository(dataSource.getRepository(BalanceExpiryLogEntity));
    entryRepo = new TypeOrmLoyaltyEntryRepository(dataSource.getRepository(LoyaltyEntryEntity));
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  afterEach(async () => {
    await dataSource.query(
      `DELETE FROM "loyalty"."balance_expiry_log" WHERE entry_id IN (SELECT id FROM "loyalty"."loyalty_entries" WHERE tenant_id = $1)`,
      [EXPIRY_LOG_TEST_TENANT],
    );
    await dataSource.query(`DELETE FROM "loyalty"."loyalty_entries" WHERE tenant_id = $1`, [
      EXPIRY_LOG_TEST_TENANT,
    ]);
  });

  it('hasBeenProcessed returns false for unknown entryId', async () => {
    expect(await repo.hasBeenProcessed(uuidv7())).toBe(false);
  });

  it('markProcessed then hasBeenProcessed returns true', async () => {
    const entry = new LoyaltyEntryBuilder().build();
    await entryRepo.save(entry);

    await repo.markProcessed(entry.id);
    expect(await repo.hasBeenProcessed(entry.id)).toBe(true);
  });

  it('marking same entryId twice does not throw (idempotent)', async () => {
    const entry = new LoyaltyEntryBuilder().build();
    await entryRepo.save(entry);

    await repo.markProcessed(entry.id);
    await expect(repo.markProcessed(entry.id)).resolves.not.toThrow();
  });
});
