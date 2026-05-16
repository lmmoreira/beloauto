import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager } from 'typeorm';

// Carries the active transactional EntityManager across await boundaries.
// Populated by TypeOrmTransactionManager.run(); read by transaction-aware repositories.
const storage = new AsyncLocalStorage<EntityManager>();

export function runWithEntityManager<T>(
  manager: EntityManager,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(manager, work);
}

export function getActiveEntityManager(): EntityManager | undefined {
  return storage.getStore();
}
