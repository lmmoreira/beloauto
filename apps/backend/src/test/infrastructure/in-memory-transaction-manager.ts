import { ITransactionManager } from '../../shared/ports/transaction-manager.port';

// No real transaction is needed for in-memory repos — just run the work directly.
// Actual rollback behaviour is covered by integration tests against a real DB.
export class InMemoryTransactionManager implements ITransactionManager {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
