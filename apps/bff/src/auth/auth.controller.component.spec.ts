import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SelectionTokenService } from './selection-token.service';
import {
  CUSTOMER_ID,
  GOOGLE_OAUTH_ID,
  TENANT_ID,
  TENANT_ID_2,
  MockBackendHttpService,
  createTestApp,
  makeCustomerJwt,
  makeManagerJwt,
  makeStaffJwt,
  request,
} from '../test/component-test.helpers';

describe('AuthController (component) — non-OAuth routes', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let selectionTokenService: SelectionTokenService;
  let backendHttpService: MockBackendHttpService;

  beforeAll(async () => {
    ({ app, jwtService, selectionTokenService, backendHttpService } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /auth/token  (public — exchanges selectionToken for a customer JWT)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /v1/auth/token', () => {
    it('400 when selectionToken field is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/token')
        .send({ tenantId: TENANT_ID });
      expect(res.status).toBe(400);
    });

    it('400 when tenantId field is missing', async () => {
      const selectionToken = selectionTokenService.issueSelectionToken(GOOGLE_OAUTH_ID);
      const res = await request(app.getHttpServer())
        .post('/v1/auth/token')
        .send({ selectionToken });
      expect(res.status).toBe(400);
    });

    it('400 when selectionToken is tampered', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/token')
        .send({ selectionToken: 'invalid.token.here', tenantId: TENANT_ID });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        status: 400,
        detail: 'Selection token is invalid or expired',
      });
    });

    it('403 when customer is not registered in the requested tenant', async () => {
      const selectionToken = selectionTokenService.issueSelectionToken(GOOGLE_OAUTH_ID);
      backendHttpService.get.mockResolvedValueOnce([
        { tenantId: TENANT_ID_2, customerId: CUSTOMER_ID },
      ]);

      const res = await request(app.getHttpServer())
        .post('/v1/auth/token')
        .send({ selectionToken, tenantId: TENANT_ID });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        status: 403,
        detail: 'Customer is not registered in this tenant',
      });
    });

    it('201 — issues JWT with correct sub, tenantId and role=CUSTOMER', async () => {
      const selectionToken = selectionTokenService.issueSelectionToken(GOOGLE_OAUTH_ID);
      backendHttpService.get
        .mockResolvedValueOnce([{ tenantId: TENANT_ID, customerId: CUSTOMER_ID }])
        .mockResolvedValueOnce({ id: TENANT_ID, slug: 'lavacar-bh', name: 'Lavacar BH' });

      const res = await request(app.getHttpServer())
        .post('/v1/auth/token')
        .send({ selectionToken, tenantId: TENANT_ID });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.expiresIn).toBe('7d');

      const decoded = jwtService.decode(res.body.accessToken as string) as Record<string, unknown>;
      expect(decoded['sub']).toBe(CUSTOMER_ID);
      expect(decoded['tenantId']).toBe(TENANT_ID);
      expect(decoded['role']).toBe('CUSTOMER');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /auth/switch-tenant  (authenticated — CUSTOMER role only)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('POST /v1/auth/switch-tenant', () => {
    it('401 without a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/switch-tenant')
        .send({ targetTenantId: TENANT_ID_2 });
      expect(res.status).toBe(401);
    });

    it('403 for MANAGER role (requires CUSTOMER)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/switch-tenant')
        .set('Authorization', `Bearer ${makeManagerJwt(jwtService)}`)
        .send({ targetTenantId: TENANT_ID_2 });
      expect(res.status).toBe(403);
    });

    it('403 for STAFF role (requires CUSTOMER)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/switch-tenant')
        .set('Authorization', `Bearer ${makeStaffJwt(jwtService)}`)
        .send({ targetTenantId: TENANT_ID_2 });
      expect(res.status).toBe(403);
    });

    it('400 when targetTenantId is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/switch-tenant')
        .set('Authorization', `Bearer ${makeCustomerJwt(jwtService)}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('403 when customer is not registered in the target tenant', async () => {
      backendHttpService.get.mockResolvedValueOnce([
        { tenantId: TENANT_ID, customerId: CUSTOMER_ID },
      ]);

      const res = await request(app.getHttpServer())
        .post('/v1/auth/switch-tenant')
        .set('Authorization', `Bearer ${makeCustomerJwt(jwtService)}`)
        .send({ targetTenantId: TENANT_ID_2 });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        status: 403,
        detail: 'Customer is not registered in the target tenant',
      });
    });

    it('201 — issues a new JWT scoped to the target tenant', async () => {
      const targetCustomerId = '20000000-0000-4000-8000-000000000002';
      backendHttpService.get
        .mockResolvedValueOnce([
          { tenantId: TENANT_ID, customerId: CUSTOMER_ID },
          { tenantId: TENANT_ID_2, customerId: targetCustomerId },
        ])
        .mockResolvedValueOnce({ id: TENANT_ID_2, slug: 'lavacar-sp', name: 'Lavacar SP' });

      const res = await request(app.getHttpServer())
        .post('/v1/auth/switch-tenant')
        .set('Authorization', `Bearer ${makeCustomerJwt(jwtService)}`)
        .send({ targetTenantId: TENANT_ID_2 });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();

      const decoded = jwtService.decode(res.body.accessToken as string) as Record<string, unknown>;
      expect(decoded['sub']).toBe(targetCustomerId);
      expect(decoded['tenantId']).toBe(TENANT_ID_2);
      expect(decoded['tenantSlug']).toBe('lavacar-sp');
      expect(decoded['role']).toBe('CUSTOMER');
    });
  });
});
