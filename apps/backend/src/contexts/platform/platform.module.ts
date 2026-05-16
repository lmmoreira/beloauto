import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HOTSITE_CONFIG_REPOSITORY, TENANT_REPOSITORY } from './application/ports';
import { ProvisionTenantUseCase } from './application/use-cases/provision-tenant.use-case';
import { HotsiteConfigEntity } from './infrastructure/entities/hotsite-config.entity';
import { TenantEntity } from './infrastructure/entities/tenant.entity';
import { InternalTenantController } from './infrastructure/controllers/internal-tenant.controller';
import { TypeOrmHotsiteConfigRepository } from './infrastructure/repositories/typeorm-hotsite-config.repository';
import { TypeOrmTenantRepository } from './infrastructure/repositories/typeorm-tenant.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity, HotsiteConfigEntity])],
  controllers: [InternalTenantController],
  providers: [
    { provide: TENANT_REPOSITORY, useClass: TypeOrmTenantRepository },
    { provide: HOTSITE_CONFIG_REPOSITORY, useClass: TypeOrmHotsiteConfigRepository },
    ProvisionTenantUseCase,
  ],
})
export class PlatformModule {}
