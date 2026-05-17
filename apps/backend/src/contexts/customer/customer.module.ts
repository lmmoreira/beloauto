import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CUSTOMER_REPOSITORY } from './application/ports/customer-repository.port';
import { CustomerEntity } from './infrastructure/entities/customer.entity';
import { TypeOrmCustomerRepository } from './infrastructure/repositories/typeorm-customer.repository';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerEntity])],
  providers: [{ provide: CUSTOMER_REPOSITORY, useClass: TypeOrmCustomerRepository }],
})
export class CustomerModule {}
