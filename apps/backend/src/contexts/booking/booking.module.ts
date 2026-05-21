import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../../shared/tenant/tenant.module';
import { TransactionManagerModule } from '../../shared/infrastructure/transaction-manager.module';
import { SCHEDULE_CLOSURE_REPOSITORY } from './application/ports/schedule-closure-repository.port';
import { SCHEDULE_OPENING_REPOSITORY } from './application/ports/schedule-opening-repository.port';
import { SERVICE_REPOSITORY } from './application/ports/service-repository.port';
import { CloseScheduleUseCase } from './application/use-cases/close-schedule.use-case';
import { CreateServiceUseCase } from './application/use-cases/create-service.use-case';
import { DeactivateServiceUseCase } from './application/use-cases/deactivate-service.use-case';
import { ListClosuresUseCase } from './application/use-cases/list-closures.use-case';
import { ListServicesUseCase } from './application/use-cases/list-services.use-case';
import { RemoveClosureUseCase } from './application/use-cases/remove-closure.use-case';
import { UpdateServiceUseCase } from './application/use-cases/update-service.use-case';
import { ScheduleClosureEntity } from './infrastructure/entities/schedule-closure.entity';
import { ScheduleOpeningEntity } from './infrastructure/entities/schedule-opening.entity';
import { ServiceEntity } from './infrastructure/entities/service.entity';
import { ScheduleClosureController } from './infrastructure/controllers/schedule-closure.controller';
import { ServiceController } from './infrastructure/controllers/service.controller';
import { TypeOrmScheduleClosureRepository } from './infrastructure/repositories/typeorm-schedule-closure.repository';
import { TypeOrmScheduleOpeningRepository } from './infrastructure/repositories/typeorm-schedule-opening.repository';
import { TypeOrmServiceRepository } from './infrastructure/repositories/typeorm-service.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceEntity, ScheduleClosureEntity, ScheduleOpeningEntity]),
    TenantModule,
    TransactionManagerModule,
  ],
  controllers: [ServiceController, ScheduleClosureController],
  providers: [
    { provide: SERVICE_REPOSITORY, useClass: TypeOrmServiceRepository },
    { provide: SCHEDULE_CLOSURE_REPOSITORY, useClass: TypeOrmScheduleClosureRepository },
    { provide: SCHEDULE_OPENING_REPOSITORY, useClass: TypeOrmScheduleOpeningRepository },
    CreateServiceUseCase,
    ListServicesUseCase,
    UpdateServiceUseCase,
    DeactivateServiceUseCase,
    CloseScheduleUseCase,
    RemoveClosureUseCase,
    ListClosuresUseCase,
  ],
})
export class BookingModule {}
