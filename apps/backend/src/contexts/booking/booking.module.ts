import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../../shared/tenant/tenant.module';
import { TransactionManagerModule } from '../../shared/infrastructure/transaction-manager.module';
import { SCHEDULE_CLOSURE_REPOSITORY } from './application/ports/schedule-closure-repository.port';
import { SERVICE_REPOSITORY } from './application/ports/service-repository.port';
import { CreateServiceUseCase } from './application/use-cases/create-service.use-case';
import { DeactivateServiceUseCase } from './application/use-cases/deactivate-service.use-case';
import { ListServicesUseCase } from './application/use-cases/list-services.use-case';
import { UpdateServiceUseCase } from './application/use-cases/update-service.use-case';
import { ScheduleClosureEntity } from './infrastructure/entities/schedule-closure.entity';
import { ServiceEntity } from './infrastructure/entities/service.entity';
import { ServiceController } from './infrastructure/controllers/service.controller';
import { TypeOrmScheduleClosureRepository } from './infrastructure/repositories/typeorm-schedule-closure.repository';
import { TypeOrmServiceRepository } from './infrastructure/repositories/typeorm-service.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceEntity, ScheduleClosureEntity]),
    TenantModule,
    TransactionManagerModule,
  ],
  controllers: [ServiceController],
  providers: [
    { provide: SERVICE_REPOSITORY, useClass: TypeOrmServiceRepository },
    { provide: SCHEDULE_CLOSURE_REPOSITORY, useClass: TypeOrmScheduleClosureRepository },
    CreateServiceUseCase,
    ListServicesUseCase,
    UpdateServiceUseCase,
    DeactivateServiceUseCase,
  ],
})
export class BookingModule {}
