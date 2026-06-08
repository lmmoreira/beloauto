import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  HotsiteConfigEntityBuilder,
  TenantEntityBuilder,
} from '../../../../test/builders/platform';
import { STORAGE_SERVICE } from '../../../../shared/ports/storage.service.port';
import { InMemoryStorageService } from '../../../../test/infrastructure/in-memory-storage.service';
import { HotsiteConfigEntity } from '../entities/hotsite-config.entity';
import { TenantEntity } from '../entities/tenant.entity';
import { createPlatformIntegrationApp } from '../../../../test/utils/platform-integration-app';

const TENANT_A = 'c2d3e4f5-0000-0000-0000-000000000001';
const TENANT_B = 'c2d3e4f5-0000-0000-0000-000000000002';
const TENANT_NO_HOTSITE = 'c2d3e4f5-0000-0000-0000-000000000003';

async function saveHotsiteConfig(
  ds: DataSource,
  tenantId: string,
  published: boolean,
): Promise<void> {
  const entity = new HotsiteConfigEntityBuilder()
    .withId(`d${tenantId.slice(1)}`)
    .withTenantId(tenantId)
    .withIsPublished(published)
    .build();

  await ds.getRepository(HotsiteConfigEntity).save(entity);
}

describe('HotsiteAdminController (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let storageService: InMemoryStorageService;

  beforeAll(async () => {
    ({ app, ds } = await createPlatformIntegrationApp());
    storageService = app.get(STORAGE_SERVICE);

    await ds
      .getRepository(TenantEntity)
      .save(new TenantEntityBuilder().withId(TENANT_A).withSlug('hotsite-admin-tenant-a').build());
    await ds
      .getRepository(TenantEntity)
      .save(new TenantEntityBuilder().withId(TENANT_B).withSlug('hotsite-admin-tenant-b').build());
    await ds
      .getRepository(TenantEntity)
      .save(
        new TenantEntityBuilder()
          .withId(TENANT_NO_HOTSITE)
          .withSlug('hotsite-admin-tenant-c')
          .build(),
      );

    await saveHotsiteConfig(ds, TENANT_A, false);
    await saveHotsiteConfig(ds, TENANT_B, false);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /tenants/hotsite', () => {
    it('returns 403 when X-Actor-Role is not MANAGER', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/tenants/hotsite')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'STAFF')
        .expect(403);

      expect(body.status).toBe(403);
    });

    it('returns 404 when no hotsite config exists for the tenant', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/tenants/hotsite')
        .set('X-Tenant-ID', TENANT_NO_HOTSITE)
        .set('X-Actor-Role', 'MANAGER')
        .expect(404);

      expect(body.status).toBe(404);
    });

    it('returns branding, layout, and isPublished for the tenant', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/tenants/hotsite')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .expect(200);

      expect(body.isPublished).toBe(false);
      expect(body.branding.primaryColor).toBe('#2563eb');
      expect(body.layout).toHaveLength(1);
      expect(body.layout[0].type).toBe('HERO');
    });
  });

  describe('PATCH /tenants/hotsite', () => {
    it('returns 400 for an invalid hex color', async () => {
      const { body } = await request(app.getHttpServer())
        .patch('/tenants/hotsite')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .send({ branding: { primaryColor: 'not-a-color' } })
        .expect(400);

      expect(body.status).toBe(400);
    });

    it('returns 400 when the branding logoUrl has not been uploaded, then 200 after upload', async () => {
      const logoPath = `tenants/${TENANT_A}/hotsite/branding/u1/logo.png`;

      const missing = await request(app.getHttpServer())
        .patch('/tenants/hotsite')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .send({ branding: { logoUrl: logoPath } })
        .expect(400);
      expect(missing.body.status).toBe(400);

      storageService.markAsUploaded(logoPath);

      const { body } = await request(app.getHttpServer())
        .patch('/tenants/hotsite')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .send({ branding: { logoUrl: logoPath } })
        .expect(200);

      expect(body.branding.logoUrl).toBe(logoPath);
    });

    it('merges and persists branding without affecting other tenants', async () => {
      const { body } = await request(app.getHttpServer())
        .patch('/tenants/hotsite')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .send({ branding: { primaryColor: '#FF5733' } })
        .expect(200);

      expect(body.branding.primaryColor).toBe('#FF5733');

      const savedA = await ds.getRepository(HotsiteConfigEntity).findOne({
        where: { tenantId: TENANT_A },
      });
      expect(savedA!.branding.primaryColor).toBe('#FF5733');

      const savedB = await ds.getRepository(HotsiteConfigEntity).findOne({
        where: { tenantId: TENANT_B },
      });
      expect(savedB!.branding.primaryColor).toBe('#2563eb');
    });
  });

  describe('POST /tenants/hotsite/publish', () => {
    it('returns 404 when no hotsite config exists for the tenant', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/tenants/hotsite/publish')
        .set('X-Tenant-ID', TENANT_NO_HOTSITE)
        .set('X-Actor-Role', 'MANAGER')
        .expect(404);

      expect(body.status).toBe(404);
    });

    it('publishes the hotsite for the tenant without affecting other tenants', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/tenants/hotsite/publish')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .expect(200);

      expect(body.isPublished).toBe(true);

      const savedB = await ds.getRepository(HotsiteConfigEntity).findOne({
        where: { tenantId: TENANT_B },
      });
      expect(savedB!.isPublished).toBe(false);
    });
  });

  describe('POST /tenants/hotsite/unpublish', () => {
    it('unpublishes the hotsite for the tenant', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/tenants/hotsite/unpublish')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .expect(200);

      expect(body.isPublished).toBe(false);
    });
  });

  describe('POST /tenants/hotsite/images/signed-url', () => {
    it('returns a tenant-scoped filePath, signedUrl, and expiresAt', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/tenants/hotsite/images/signed-url')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .send({ fileName: 'logo.png', contentType: 'image/png', purpose: 'branding' })
        .expect(201);

      expect(body.filePath.startsWith(`tenants/${TENANT_A}/hotsite/branding/`)).toBe(true);
      expect(body.signedUrl).toContain(body.filePath);
      expect(body.expiresAt).toBeDefined();
    });

    it('returns 400 for an invalid contentType', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/tenants/hotsite/images/signed-url')
        .set('X-Tenant-ID', TENANT_A)
        .set('X-Actor-Role', 'MANAGER')
        .send({ fileName: 'logo.gif', contentType: 'image/gif', purpose: 'branding' })
        .expect(400);

      expect(body.status).toBe(400);
    });
  });
});
