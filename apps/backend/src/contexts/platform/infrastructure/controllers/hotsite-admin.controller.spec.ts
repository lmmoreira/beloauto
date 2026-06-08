import { HttpException, HttpStatus } from '@nestjs/common';
import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryStorageService } from '../../../../test/infrastructure/in-memory-storage.service';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { HotsiteConfigBuilder } from '../../../../test/builders/platform';
import { InMemoryHotsiteConfigRepository } from '../../../../test/repositories/platform/in-memory-hotsite-config.repository';
import { HotsiteImagePathsService } from '../../domain/services/hotsite-image-paths.service';
import { GetHotsiteContentUseCase } from '../../application/use-cases/get-hotsite-content.use-case';
import { UpdateHotsiteContentUseCase } from '../../application/use-cases/update-hotsite-content.use-case';
import { PublishHotsiteUseCase } from '../../application/use-cases/publish-hotsite.use-case';
import { UnpublishHotsiteUseCase } from '../../application/use-cases/unpublish-hotsite.use-case';
import { GenerateHotsiteImageSignedUrlUseCase } from '../../application/use-cases/generate-hotsite-image-signed-url.use-case';
import { HotsiteAdminController } from './hotsite-admin.controller';

const TENANT_A = '10000000-0000-4000-8000-000000000001';

describe('HotsiteAdminController', () => {
  let repo: InMemoryHotsiteConfigRepository;
  let storageService: InMemoryStorageService;
  let controller: HotsiteAdminController;

  beforeEach(() => {
    repo = new InMemoryHotsiteConfigRepository();
    storageService = new InMemoryStorageService();
    const ctx = new TenantContextBuilder().withTenantId(TENANT_A).build();
    const txManager = new InMemoryTransactionManager();

    controller = new HotsiteAdminController(
      new GetHotsiteContentUseCase(repo, ctx),
      new UpdateHotsiteContentUseCase(
        repo,
        storageService,
        txManager,
        ctx,
        new HotsiteImagePathsService(),
      ),
      new PublishHotsiteUseCase(repo, txManager, ctx),
      new UnpublishHotsiteUseCase(repo, txManager, ctx),
      new GenerateHotsiteImageSignedUrlUseCase(ctx, storageService),
    );
  });

  describe('getContent', () => {
    it('returns branding, layout, and isPublished for the tenant', async () => {
      const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildWithContent();
      await repo.save(config);

      const result = await controller.getContent();

      expect(result.branding).toEqual(config.branding);
      expect(result.layout).toEqual(config.layout);
      expect(result.isPublished).toBe(config.isPublished);
    });

    it('maps HotsiteNotFoundError to 404 when no config exists for the tenant', async () => {
      const err = await controller.getContent().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('updateContent', () => {
    it('merges and persists branding changes', async () => {
      const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildWithContent();
      await repo.save(config);

      const result = await controller.updateContent({ branding: { primaryColor: '#FF5733' } });

      expect(result.branding.primaryColor).toBe('#FF5733');
    });

    it('maps HotsiteNotFoundError to 404 when no config exists for the tenant', async () => {
      const err = await controller
        .updateContent({ branding: { primaryColor: '#FF5733' } })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('maps PlatformDomainError to 400 when branding has an invalid hex color', async () => {
      const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildWithContent();
      await repo.save(config);

      const err = await controller
        .updateContent({ branding: { primaryColor: 'not-a-color' } })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('maps HotsiteImageNotUploadedError to 400 when the branding logoUrl is not in storage', async () => {
      const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildWithContent();
      await repo.save(config);
      const logoPath = `tenants/${TENANT_A}/hotsite/branding/u1/logo.png`;

      const err = await controller
        .updateContent({ branding: { logoUrl: logoPath } })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('publish', () => {
    it('publishes the hotsite and returns isPublished true', async () => {
      const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildWithContent();
      await repo.save(config);

      const result = await controller.publish();

      expect(result.isPublished).toBe(true);
    });

    it('maps HotsiteNotFoundError to 404 when no config exists for the tenant', async () => {
      const err = await controller.publish().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('maps PlatformDomainError to 400 when the layout has no enabled modules', async () => {
      const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).build();
      await repo.save(config);

      const err = await controller.publish().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('unpublish', () => {
    it('unpublishes the hotsite and returns isPublished false', async () => {
      const config = new HotsiteConfigBuilder().withTenantId(TENANT_A).buildPublished();
      await repo.save(config);

      const result = await controller.unpublish();

      expect(result.isPublished).toBe(false);
    });

    it('maps HotsiteNotFoundError to 404 when no config exists for the tenant', async () => {
      const err = await controller.unpublish().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('generateImageSignedUrl', () => {
    it('returns a tenant-scoped filePath, signedUrl, and expiresAt', async () => {
      const result = await controller.generateImageSignedUrl({
        fileName: 'logo.png',
        contentType: 'image/png',
        purpose: 'branding',
      });

      expect(result.filePath.startsWith(`tenants/${TENANT_A}/hotsite/branding/`)).toBe(true);
      expect(result.signedUrl).toContain(result.filePath);
      expect(result.expiresAt).toBe('2099-01-01T00:00:00.000Z');
    });
  });
});
