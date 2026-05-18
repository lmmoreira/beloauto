import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { STAFF_REPOSITORY } from './application/ports/staff-repository.port';
import { StaffEntity } from './infrastructure/entities/staff.entity';
import { TypeOrmStaffRepository } from './infrastructure/repositories/typeorm-staff.repository';

@Module({
  imports: [TypeOrmModule.forFeature([StaffEntity])],
  providers: [{ provide: STAFF_REPOSITORY, useClass: TypeOrmStaffRepository }],
})
export class StaffModule {}
