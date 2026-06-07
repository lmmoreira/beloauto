import { Inject, Injectable } from '@nestjs/common';
import { IStorageService, STORAGE_SERVICE } from '../../../../shared/ports/storage.service.port';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../shared/ports/transaction-manager.port';
import { TenantContext } from '../../../../shared/tenant/tenant-context';
import {
  HotsiteImageNotUploadedError,
  HotsiteNotFoundError,
} from '../../domain/errors/platform-domain.error';
import {
  GalleryImage,
  HotsiteBranding,
  HotsiteModule,
} from '../../domain/hotsite-config.aggregate';
import {
  HOTSITE_CONFIG_REPOSITORY,
  IHotsiteConfigRepository,
} from '../ports/hotsite-config-repository.port';
import { UpdateHotsiteContentDto } from '../dtos/update-hotsite-content.dto';

export interface UpdateHotsiteContentUseCaseResult {
  branding: HotsiteBranding;
  layout: HotsiteModule[];
  isPublished: boolean;
}

@Injectable()
export class UpdateHotsiteContentUseCase {
  constructor(
    @Inject(HOTSITE_CONFIG_REPOSITORY)
    private readonly hotsiteConfigRepo: IHotsiteConfigRepository,
    @Inject(STORAGE_SERVICE) private readonly storageService: IStorageService,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
    private readonly tenantContext: TenantContext,
  ) {}

  async execute(dto: UpdateHotsiteContentDto): Promise<UpdateHotsiteContentUseCaseResult> {
    const tenantId = this.tenantContext.tenantId;
    const config = await this.hotsiteConfigRepo.findByTenantId(tenantId);
    if (!config) throw new HotsiteNotFoundError(tenantId);

    const branding: HotsiteBranding = dto.branding
      ? { ...config.branding, ...dto.branding }
      : config.branding;
    const layout: HotsiteModule[] = dto.layout
      ? (dto.layout as unknown as HotsiteModule[])
      : config.layout;

    await this.verifyImagesExist(branding, layout);

    config.updateContent(branding, layout);

    await this.txManager.run(async () => {
      await this.hotsiteConfigRepo.save(config);
    });

    return { branding: config.branding, layout: config.layout, isPublished: config.isPublished };
  }

  private async verifyImagesExist(
    branding: HotsiteBranding,
    layout: HotsiteModule[],
  ): Promise<void> {
    for (const path of this.collectImagePaths(branding, layout)) {
      const exists = await this.storageService.exists(path);
      if (!exists) throw new HotsiteImageNotUploadedError(path);
    }
  }

  private collectImagePaths(branding: HotsiteBranding, layout: HotsiteModule[]): string[] {
    const paths: string[] = [];
    this.pushIfPath(paths, branding.logoUrl);

    for (const module of layout) {
      const data = module.data as unknown as Record<string, unknown>;
      this.pushIfPath(paths, data.backgroundImageUrl);
      this.pushIfPath(paths, data.imageUrl);
      this.pushIfPath(paths, data.avatarUrl);

      if (module.type === 'TESTIMONIALS') {
        const items = (data.items as { avatarUrl?: string }[] | undefined) ?? [];
        for (const item of items) this.pushIfPath(paths, item.avatarUrl);
      }

      if (module.type === 'GALLERY') {
        const images = (data.images as GalleryImage[] | undefined) ?? [];
        for (const image of images) {
          if (image.source === 'upload') this.pushIfPath(paths, image.url);
        }
      }
    }

    return paths;
  }

  private pushIfPath(paths: string[], value: unknown): void {
    if (typeof value === 'string' && value.length > 0) paths.push(value);
  }
}
