import { Inject, Injectable } from '@nestjs/common';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../shared/ports/transaction-manager.port';
import { TenantContext } from '../../../../shared/tenant/tenant-context';
import { HotsiteNotFoundError } from '../../domain/errors/platform-domain.error';
import {
  HOTSITE_CONFIG_REPOSITORY,
  IHotsiteConfigRepository,
} from '../ports/hotsite-config-repository.port';

export interface UnpublishHotsiteUseCaseResult {
  isPublished: boolean;
}

@Injectable()
export class UnpublishHotsiteUseCase {
  constructor(
    @Inject(HOTSITE_CONFIG_REPOSITORY)
    private readonly hotsiteConfigRepo: IHotsiteConfigRepository,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
    private readonly tenantContext: TenantContext,
  ) {}

  async execute(): Promise<UnpublishHotsiteUseCaseResult> {
    const tenantId = this.tenantContext.tenantId;
    const config = await this.hotsiteConfigRepo.findByTenantId(tenantId);
    if (!config) throw new HotsiteNotFoundError(tenantId);

    config.unpublish();

    await this.txManager.run(async () => {
      await this.hotsiteConfigRepo.save(config);
    });

    return { isPublished: config.isPublished };
  }
}
