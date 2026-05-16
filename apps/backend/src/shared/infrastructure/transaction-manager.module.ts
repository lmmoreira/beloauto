import { Global, Module } from '@nestjs/common';
import { TRANSACTION_MANAGER } from '../ports/transaction-manager.port';
import { TypeOrmTransactionManager } from './typeorm-transaction-manager';

// @Global makes TRANSACTION_MANAGER injectable in every context module without an explicit import.
// Imported once in AppModule. Replace TypeOrmTransactionManager with another adapter if the ORM changes.
@Global()
@Module({
  providers: [{ provide: TRANSACTION_MANAGER, useClass: TypeOrmTransactionManager }],
  exports: [TRANSACTION_MANAGER],
})
export class TransactionManagerModule {}
