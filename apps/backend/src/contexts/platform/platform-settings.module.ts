import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TENANT_REPOSITORY } from './application/ports/tenant-repository.port';
import { GetTenantSettingsUseCase } from './application/use-cases/get-tenant-settings.use-case';
import { TenantEntity } from './infrastructure/entities/tenant.entity';
import { TypeOrmTenantRepository } from './infrastructure/repositories/typeorm-tenant.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  providers: [
    { provide: TENANT_REPOSITORY, useClass: TypeOrmTenantRepository },
    GetTenantSettingsUseCase,
  ],
  exports: [GetTenantSettingsUseCase],
})
export class PlatformSettingsModule {}
