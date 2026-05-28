import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { actorHeaders } from '../../../../test/utils/actor-headers';
import { createLoyaltyIntegrationApp } from '../../../../test/utils/loyalty-integration-app';
import { InMemoryServiceCatalogPort } from '../../../../test/infrastructure/in-memory-service-catalog.port';
import { LoyaltyBalanceEntity } from '../entities/loyalty-balance.entity';
import { LoyaltyEntryEntity } from '../entities/loyalty-entry.entity';
import { LoyaltyRedemptionEntity } from '../entities/loyalty-redemption.entity';
import {
  LoyaltyBalanceEntityBuilder,
  LoyaltyEntryEntityBuilder,
  LoyaltyRedemptionEntityBuilder,
} from '../../../../test/builders/loyalty/index';

const TEST_KEY = 'loyalty-integ-test-key-loyalty-xxxx';
const CUSTOMER_ID = 'aaaaaaaa-0000-7000-8000-000000000001';
const STAFF_ID = 'bbbbbbbb-0000-7000-8000-000000000001';
const SERVICE_ID = 'cccccccc-0000-7000-8000-000000000001';

describe('LoyaltyController (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let serviceCatalog: InMemoryServiceCatalogPort;
  let tenantId: string;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = TEST_KEY;
    ({ app, ds, serviceCatalog } = await createLoyaltyIntegrationApp());

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${TEST_KEY}`)
      .send({
        name: 'Loyalty Test Tenant',
        slug: 'loyalty-test-tenant',
        adminEmail: 'admin@loyalty.test',
      })
      .expect(201);
    tenantId = body.tenantId as string;

    serviceCatalog.seed([{ serviceId: SERVICE_ID, serviceName: 'Lavagem Completa' }]);
  });

  afterAll(async () => {
    delete process.env['PLATFORM_ADMIN_KEY'];
    await app.close();
  });

  afterEach(async () => {
    await ds.getRepository(LoyaltyEntryEntity).delete({ tenantId });
    await ds.getRepository(LoyaltyBalanceEntity).delete({ tenantId });
    await ds.getRepository(LoyaltyRedemptionEntity).delete({ tenantId });
  });

  // ── Customer: GET /loyalty/balance ────────────────────────────────────────

  describe('GET /loyalty/balance (customer)', () => {
    it('returns zero balance when customer has no data', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/loyalty/balance')
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(200);

      expect(body.currentPoints).toBe(0);
      expect(body.nextExpiryDate).toBeNull();
      expect(body.nextExpiryPoints).toBeNull();
    });

    it('returns currentPoints from balance row', async () => {
      await ds
        .getRepository(LoyaltyBalanceEntity)
        .save(
          new LoyaltyBalanceEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withCurrentPoints(75)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get('/loyalty/balance')
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(200);

      expect(body.currentPoints).toBe(75);
    });

    it('returns nextExpiryDate and nextExpiryPoints', async () => {
      const sooner = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const later = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await ds
        .getRepository(LoyaltyEntryEntity)
        .save([
          new LoyaltyEntryEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withPoints(10)
            .withExpiresAt(sooner)
            .build(),
          new LoyaltyEntryEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withPoints(20)
            .withExpiresAt(later)
            .build(),
        ]);

      const { body } = await request(app.getHttpServer())
        .get('/loyalty/balance')
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(200);

      expect(body.nextExpiryPoints).toBe(10);
      expect(new Date(body.nextExpiryDate as string).getTime()).toBeCloseTo(sooner.getTime(), -3);
    });

    it('returns 403 when called with STAFF role', async () => {
      await request(app.getHttpServer())
        .get('/loyalty/balance')
        .set(actorHeaders(tenantId, STAFF_ID, 'STAFF'))
        .expect(403);
    });

    it('tenant isolation: CUSTOMER_ID from Tenant A cannot see Tenant B data', async () => {
      const { body: b } = await request(app.getHttpServer())
        .post('/internal/tenants')
        .set('Authorization', `Bearer ${TEST_KEY}`)
        .send({
          name: 'Loyalty Tenant B',
          slug: 'loyalty-tenant-b',
          adminEmail: 'b@loyalty.test',
        })
        .expect(201);
      const tenantBId = b.tenantId as string;

      await ds
        .getRepository(LoyaltyBalanceEntity)
        .save(
          new LoyaltyBalanceEntityBuilder()
            .withTenantId(tenantBId)
            .withCustomerId(CUSTOMER_ID)
            .withCurrentPoints(999)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get('/loyalty/balance')
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(200);

      expect(body.currentPoints).toBe(0);

      await ds.getRepository(LoyaltyBalanceEntity).delete({ tenantId: tenantBId });
    });
  });

  // ── Customer: GET /loyalty/entries ────────────────────────────────────────

  describe('GET /loyalty/entries (customer)', () => {
    it('returns paginated entries with serviceName', async () => {
      await ds
        .getRepository(LoyaltyEntryEntity)
        .save(
          new LoyaltyEntryEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withServiceId(SERVICE_ID)
            .withPoints(10)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get('/loyalty/entries')
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(200);

      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].serviceName).toBe('Lavagem Completa');
      expect(body.entries[0].points).toBe(10);
      expect(body.pagination.total).toBe(1);
    });

    it('marks expired entries as isActive=false', async () => {
      const past = new Date(Date.now() - 1000);
      await ds
        .getRepository(LoyaltyEntryEntity)
        .save(
          new LoyaltyEntryEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withExpiresAt(past)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get('/loyalty/entries')
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(200);

      expect(body.entries[0].isActive).toBe(false);
    });

    it('returns 403 when called with MANAGER role', async () => {
      await request(app.getHttpServer())
        .get('/loyalty/entries')
        .set(actorHeaders(tenantId, STAFF_ID, 'MANAGER'))
        .expect(403);
    });
  });

  // ── Customer: GET /loyalty/redemptions ───────────────────────────────────

  describe('GET /loyalty/redemptions (customer)', () => {
    it('returns empty list when customer has no redemptions', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/loyalty/redemptions')
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(200);

      expect(body.redemptions).toHaveLength(0);
    });

    it('returns paginated redemptions', async () => {
      await ds
        .getRepository(LoyaltyRedemptionEntity)
        .save(
          new LoyaltyRedemptionEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withPointsRedeemed(50)
            .withNotes('Free wash')
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get('/loyalty/redemptions')
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(200);

      expect(body.redemptions[0].pointsRedeemed).toBe(50);
      expect(body.redemptions[0].notes).toBe('Free wash');
    });
  });

  // ── Admin: GET /customers/:customerId/loyalty/* ───────────────────────────

  describe('GET /customers/:customerId/loyalty/balance (admin)', () => {
    it('returns balance for specified customer', async () => {
      await ds
        .getRepository(LoyaltyBalanceEntity)
        .save(
          new LoyaltyBalanceEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withCurrentPoints(40)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(`/customers/${CUSTOMER_ID}/loyalty/balance`)
        .set(actorHeaders(tenantId, STAFF_ID, 'MANAGER'))
        .expect(200);

      expect(body.currentPoints).toBe(40);
    });

    it('returns 403 when called with CUSTOMER role', async () => {
      await request(app.getHttpServer())
        .get(`/customers/${CUSTOMER_ID}/loyalty/balance`)
        .set(actorHeaders(tenantId, CUSTOMER_ID, 'CUSTOMER'))
        .expect(403);
    });

    it('tenant isolation: STAFF from Tenant B cannot access Tenant A customer data', async () => {
      const { body: b } = await request(app.getHttpServer())
        .post('/internal/tenants')
        .set('Authorization', `Bearer ${TEST_KEY}`)
        .send({
          name: 'Loyalty Tenant C',
          slug: 'loyalty-tenant-c',
          adminEmail: 'c@loyalty.test',
        })
        .expect(201);
      const tenantCId = b.tenantId as string;

      await ds
        .getRepository(LoyaltyBalanceEntity)
        .save(
          new LoyaltyBalanceEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withCurrentPoints(999)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(`/customers/${CUSTOMER_ID}/loyalty/balance`)
        .set(actorHeaders(tenantCId, STAFF_ID, 'MANAGER'))
        .expect(200);

      expect(body.currentPoints).toBe(0);
    });
  });

  describe('GET /customers/:customerId/loyalty/entries (admin)', () => {
    it('returns entries for specified customer', async () => {
      await ds
        .getRepository(LoyaltyEntryEntity)
        .save(
          new LoyaltyEntryEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withPoints(25)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(`/customers/${CUSTOMER_ID}/loyalty/entries`)
        .set(actorHeaders(tenantId, STAFF_ID, 'STAFF'))
        .expect(200);

      expect(body.entries[0].points).toBe(25);
    });
  });

  describe('GET /customers/:customerId/loyalty/redemptions (admin)', () => {
    it('returns redemptions for specified customer', async () => {
      await ds
        .getRepository(LoyaltyRedemptionEntity)
        .save(
          new LoyaltyRedemptionEntityBuilder()
            .withTenantId(tenantId)
            .withCustomerId(CUSTOMER_ID)
            .withPointsRedeemed(15)
            .build(),
        );

      const { body } = await request(app.getHttpServer())
        .get(`/customers/${CUSTOMER_ID}/loyalty/redemptions`)
        .set(actorHeaders(tenantId, STAFF_ID, 'STAFF'))
        .expect(200);

      expect(body.redemptions[0].pointsRedeemed).toBe(15);
    });
  });
});
