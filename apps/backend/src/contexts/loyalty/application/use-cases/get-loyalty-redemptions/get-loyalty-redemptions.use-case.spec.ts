import { InMemoryLoyaltyRedemptionRepository } from '../../../../../test/infrastructure/in-memory-loyalty-redemption.repository';
import { LoyaltyRedemptionBuilder } from '../../../../../test/builders/loyalty/index';
import { GetLoyaltyRedemptionsUseCase } from './get-loyalty-redemptions.use-case';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const CUSTOMER_ID = 'aaaaaaaa-0000-7000-8000-000000000001';

describe('GetLoyaltyRedemptionsUseCase', () => {
  let redemptionRepo: InMemoryLoyaltyRedemptionRepository;
  let useCase: GetLoyaltyRedemptionsUseCase;

  beforeEach(() => {
    redemptionRepo = new InMemoryLoyaltyRedemptionRepository();
    useCase = new GetLoyaltyRedemptionsUseCase(redemptionRepo);
  });

  it('returns empty list when customer has no redemptions', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      customerId: CUSTOMER_ID,
      page: 1,
      limit: 20,
    });

    expect(result.redemptions).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('maps redemption fields correctly', async () => {
    await redemptionRepo.save(
      new LoyaltyRedemptionBuilder()
        .withTenantId(TENANT_ID)
        .withCustomerId(CUSTOMER_ID)
        .withPointsRedeemed(50)
        .withNotes('Free basic wash')
        .build(),
    );

    const result = await useCase.execute({
      tenantId: TENANT_ID,
      customerId: CUSTOMER_ID,
      page: 1,
      limit: 20,
    });

    expect(result.redemptions).toHaveLength(1);
    expect(result.redemptions[0].pointsRedeemed).toBe(50);
    expect(result.redemptions[0].notes).toBe('Free basic wash');
    expect(result.redemptions[0].redemptionId).toBeDefined();
    expect(result.redemptions[0].redeemedAt).toBeDefined();
  });

  it('returns pagination metadata', async () => {
    for (let i = 0; i < 3; i++) {
      await redemptionRepo.save(
        new LoyaltyRedemptionBuilder().withTenantId(TENANT_ID).withCustomerId(CUSTOMER_ID).build(),
      );
    }

    const result = await useCase.execute({
      tenantId: TENANT_ID,
      customerId: CUSTOMER_ID,
      page: 1,
      limit: 2,
    });

    expect(result.redemptions).toHaveLength(2);
    expect(result.pagination).toEqual({ page: 1, limit: 2, total: 3 });
  });

  it('does not return redemptions from another customer', async () => {
    const otherCustomer = 'cccccccc-0000-7000-8000-000000000001';
    await redemptionRepo.save(
      new LoyaltyRedemptionBuilder().withTenantId(TENANT_ID).withCustomerId(otherCustomer).build(),
    );

    const result = await useCase.execute({
      tenantId: TENANT_ID,
      customerId: CUSTOMER_ID,
      page: 1,
      limit: 20,
    });

    expect(result.redemptions).toHaveLength(0);
  });
});
