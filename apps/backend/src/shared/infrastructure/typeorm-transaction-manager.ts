import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ITransactionManager } from '../ports/transaction-manager.port';
import { runWithEntityManager } from './transaction-context';

@Injectable()
export class TypeOrmTransactionManager implements ITransactionManager {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction((entityManager) =>
      runWithEntityManager(entityManager, work),
    );
  }
}
