import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { STAFF_REPOSITORY } from './application/ports/staff-repository.port';
import { ActivateStaffUseCase } from './application/use-cases/activate-staff.use-case';
import { GetStaffByEmailUseCase } from './application/use-cases/get-staff-by-email.use-case';
import { GetStaffByOAuthIdUseCase } from './application/use-cases/get-staff-by-oauth-id.use-case';
import { InternalStaffController } from './infrastructure/controllers/internal-staff.controller';
import { StaffEntity } from './infrastructure/entities/staff.entity';
import { TypeOrmStaffRepository } from './infrastructure/repositories/typeorm-staff.repository';

@Module({
  imports: [TypeOrmModule.forFeature([StaffEntity])],
  controllers: [InternalStaffController],
  providers: [
    { provide: STAFF_REPOSITORY, useClass: TypeOrmStaffRepository },
    GetStaffByOAuthIdUseCase,
    GetStaffByEmailUseCase,
    ActivateStaffUseCase,
  ],
})
export class StaffModule {}
