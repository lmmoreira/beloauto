import { InMemoryLoyaltyBalanceRepository } from '../../../../test/infrastructure/in-memory-loyalty-balance.repository';
import { InMemoryLoyaltyEntryRepository } from '../../../../test/infrastructure/in-memory-loyalty-entry.repository';
import { InMemoryLoyaltyRedemptionRepository } from '../../../../test/infrastructure/in-memory-loyalty-redemption.repository';
import { InMemoryServiceCatalogPort } from '../../../../test/infrastructure/in-memory-service-catalog.port';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import {
  LoyaltyBalanceBuilder,
  LoyaltyEntryBuilder,
  LoyaltyRedemptionBuilder,
} from '../../../../test/builders/loyalty/index';
import { GetLoyaltyBalanceUseCase } from '../../application/use-cases/get-loyalty-balance/get-loyalty-balance.use-case';
import { GetLoyaltyEntriesUseCase } from '../../application/use-cases/get-loyalty-entries/get-loyalty-entries.use-case';
import { GetLoyaltyRedemptionsUseCase } from '../../application/use-cases/get-loyalty-redemptions/get-loyalty-redemptions.use-case';
import { LoyaltyController } from './loyalty.controller';

const TENANT_ID = '10000000-0000-7000-8000-000000000001';
const CUSTOMER_ID = 'aaaaaaaa-0000-7000-8000-000000000001';
const STAFF_ID = 'bbbbbbbb-0000-7000-8000-000000000001';
const SERVICE_ID = 'cccccccc-0000-7000-8000-000000000001';

describe('LoyaltyController', () => {
  let balanceRepo: InMemoryLoyaltyBalanceRepository;
  let entryRepo: InMemoryLoyaltyEntryRepository;
  let redemptionRepo: InMemoryLoyaltyRedemptionRepository;
  let serviceCatalog: InMemoryServiceCatalogPort;
  let controller: LoyaltyController;

  describe('getBalance() — customer route', () => {
    beforeEach(() => {
      balanceRepo = new InMemoryLoyaltyBalanceRepository();
      entryRepo = new InMemoryLoyaltyEntryRepository();
      redemptionRepo = new InMemoryLoyaltyRedemptionRepository();
      serviceCatalog = new InMemoryServiceCatalogPort();
      const ctx = new TenantContextBuilder()
        .withTenantId(TENANT_ID)
        .withActorId(CUSTOMER_ID)
        .withActorType('CUSTOMER')
        .withActorRole('CUSTOMER')
        .build();
      controller = new LoyaltyController(
        new GetLoyaltyBalanceUseCase(balanceRepo, entryRepo),
        new GetLoyaltyEntriesUseCase(entryRepo, serviceCatalog),
        new GetLoyaltyRedemptionsUseCase(redemptionRepo),
        ctx,
      );
    });

    it('returns zero balance when customer has no data', async () => {
      const result = await controller.getBalance();
      expect(result.currentPoints).toBe(0);
      expect(result.nextExpiryDate).toBeNull();
    });

    it('returns currentPoints from balance row', async () => {
      await balanceRepo.upsert(
        new LoyaltyBalanceBuilder()
          .withTenantId(TENANT_ID)
          .withCustomerId(CUSTOMER_ID)
          .withCurrentPoints(100)
          .build(),
      );

      const result = await controller.getBalance();
      expect(result.currentPoints).toBe(100);
    });
  });

  describe('getEntries() — customer route', () => {
    beforeEach(() => {
      balanceRepo = new InMemoryLoyaltyBalanceRepository();
      entryRepo = new InMemoryLoyaltyEntryRepository();
      redemptionRepo = new InMemoryLoyaltyRedemptionRepository();
      serviceCatalog = new InMemoryServiceCatalogPort();
      const ctx = new TenantContextBuilder()
        .withTenantId(TENANT_ID)
        .withActorId(CUSTOMER_ID)
        .withActorType('CUSTOMER')
        .withActorRole('CUSTOMER')
        .build();
      controller = new LoyaltyController(
        new GetLoyaltyBalanceUseCase(balanceRepo, entryRepo),
        new GetLoyaltyEntriesUseCase(entryRepo, serviceCatalog),
        new GetLoyaltyRedemptionsUseCase(redemptionRepo),
        ctx,
      );
    });

    it('returns empty entries list', async () => {
      const result = await controller.getEntries({ page: 1, limit: 20 });
      expect(result.entries).toHaveLength(0);
    });

    it('resolves serviceName from catalog', async () => {
      serviceCatalog.seed([{ serviceId: SERVICE_ID, serviceName: 'Lavagem Completa' }]);
      await entryRepo.save(
        new LoyaltyEntryBuilder()
          .withTenantId(TENANT_ID)
          .withCustomerId(CUSTOMER_ID)
          .withServiceId(SERVICE_ID)
          .build(),
      );

      const result = await controller.getEntries({ page: 1, limit: 20 });
      expect(result.entries[0].serviceName).toBe('Lavagem Completa');
    });
  });

  describe('getRedemptions() — customer route', () => {
    beforeEach(() => {
      balanceRepo = new InMemoryLoyaltyBalanceRepository();
      entryRepo = new InMemoryLoyaltyEntryRepository();
      redemptionRepo = new InMemoryLoyaltyRedemptionRepository();
      serviceCatalog = new InMemoryServiceCatalogPort();
      const ctx = new TenantContextBuilder()
        .withTenantId(TENANT_ID)
        .withActorId(CUSTOMER_ID)
        .withActorType('CUSTOMER')
        .withActorRole('CUSTOMER')
        .build();
      controller = new LoyaltyController(
        new GetLoyaltyBalanceUseCase(balanceRepo, entryRepo),
        new GetLoyaltyEntriesUseCase(entryRepo, serviceCatalog),
        new GetLoyaltyRedemptionsUseCase(redemptionRepo),
        ctx,
      );
    });

    it('returns empty redemptions list', async () => {
      const result = await controller.getRedemptions({ page: 1, limit: 20 });
      expect(result.redemptions).toHaveLength(0);
    });

    it('returns customer redemptions', async () => {
      await redemptionRepo.save(
        new LoyaltyRedemptionBuilder()
          .withTenantId(TENANT_ID)
          .withCustomerId(CUSTOMER_ID)
          .withPointsRedeemed(30)
          .build(),
      );

      const result = await controller.getRedemptions({ page: 1, limit: 20 });
      expect(result.redemptions[0].pointsRedeemed).toBe(30);
    });
  });

  describe('getBalanceAdmin() — admin route', () => {
    beforeEach(() => {
      balanceRepo = new InMemoryLoyaltyBalanceRepository();
      entryRepo = new InMemoryLoyaltyEntryRepository();
      redemptionRepo = new InMemoryLoyaltyRedemptionRepository();
      serviceCatalog = new InMemoryServiceCatalogPort();
      const ctx = new TenantContextBuilder()
        .withTenantId(TENANT_ID)
        .withActorId(STAFF_ID)
        .withActorType('STAFF')
        .withActorRole('MANAGER')
        .build();
      controller = new LoyaltyController(
        new GetLoyaltyBalanceUseCase(balanceRepo, entryRepo),
        new GetLoyaltyEntriesUseCase(entryRepo, serviceCatalog),
        new GetLoyaltyRedemptionsUseCase(redemptionRepo),
        ctx,
      );
    });

    it('returns zero balance for customer with no data', async () => {
      const result = await controller.getBalanceAdmin(CUSTOMER_ID);
      expect(result.currentPoints).toBe(0);
    });

    it('returns balance for specified customerId', async () => {
      await balanceRepo.upsert(
        new LoyaltyBalanceBuilder()
          .withTenantId(TENANT_ID)
          .withCustomerId(CUSTOMER_ID)
          .withCurrentPoints(55)
          .build(),
      );

      const result = await controller.getBalanceAdmin(CUSTOMER_ID);
      expect(result.currentPoints).toBe(55);
    });
  });

  describe('getEntriesAdmin() — admin route', () => {
    beforeEach(() => {
      balanceRepo = new InMemoryLoyaltyBalanceRepository();
      entryRepo = new InMemoryLoyaltyEntryRepository();
      redemptionRepo = new InMemoryLoyaltyRedemptionRepository();
      serviceCatalog = new InMemoryServiceCatalogPort();
      const ctx = new TenantContextBuilder()
        .withTenantId(TENANT_ID)
        .withActorId(STAFF_ID)
        .withActorType('STAFF')
        .withActorRole('STAFF')
        .build();
      controller = new LoyaltyController(
        new GetLoyaltyBalanceUseCase(balanceRepo, entryRepo),
        new GetLoyaltyEntriesUseCase(entryRepo, serviceCatalog),
        new GetLoyaltyRedemptionsUseCase(redemptionRepo),
        ctx,
      );
    });

    it('returns entries for specified customerId', async () => {
      await entryRepo.save(
        new LoyaltyEntryBuilder()
          .withTenantId(TENANT_ID)
          .withCustomerId(CUSTOMER_ID)
          .withPoints(15)
          .build(),
      );

      const result = await controller.getEntriesAdmin(CUSTOMER_ID, { page: 1, limit: 20 });
      expect(result.entries[0].points).toBe(15);
    });
  });

  describe('getRedemptionsAdmin() — admin route', () => {
    beforeEach(() => {
      balanceRepo = new InMemoryLoyaltyBalanceRepository();
      entryRepo = new InMemoryLoyaltyEntryRepository();
      redemptionRepo = new InMemoryLoyaltyRedemptionRepository();
      serviceCatalog = new InMemoryServiceCatalogPort();
      const ctx = new TenantContextBuilder()
        .withTenantId(TENANT_ID)
        .withActorId(STAFF_ID)
        .withActorType('STAFF')
        .withActorRole('STAFF')
        .build();
      controller = new LoyaltyController(
        new GetLoyaltyBalanceUseCase(balanceRepo, entryRepo),
        new GetLoyaltyEntriesUseCase(entryRepo, serviceCatalog),
        new GetLoyaltyRedemptionsUseCase(redemptionRepo),
        ctx,
      );
    });

    it('returns redemptions for specified customerId', async () => {
      await redemptionRepo.save(
        new LoyaltyRedemptionBuilder()
          .withTenantId(TENANT_ID)
          .withCustomerId(CUSTOMER_ID)
          .withPointsRedeemed(20)
          .build(),
      );

      const result = await controller.getRedemptionsAdmin(CUSTOMER_ID, { page: 1, limit: 20 });
      expect(result.redemptions[0].pointsRedeemed).toBe(20);
    });
  });
});
