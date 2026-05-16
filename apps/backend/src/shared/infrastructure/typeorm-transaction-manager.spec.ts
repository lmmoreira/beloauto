import { DataSource, EntityManager } from 'typeorm';
import { getActiveEntityManager } from './transaction-context';
import { TypeOrmTransactionManager } from './typeorm-transaction-manager';

describe('TypeOrmTransactionManager', () => {
  it('wraps work in a DataSource transaction and propagates EntityManager via AsyncLocalStorage', async () => {
    const mockEntityManager = {} as EntityManager;
    const mockDataSource = {
      transaction: jest.fn((fn: (em: EntityManager) => Promise<void>) => fn(mockEntityManager)),
    } as unknown as DataSource;

    const txManager = new TypeOrmTransactionManager(mockDataSource);

    let capturedManager: EntityManager | undefined;
    await txManager.run(async () => {
      capturedManager = getActiveEntityManager();
    });

    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(capturedManager).toBe(mockEntityManager);
  });

  it('returns the value produced by the work function', async () => {
    const mockDataSource = {
      transaction: jest.fn((fn: (em: EntityManager) => Promise<number>) => fn({} as EntityManager)),
    } as unknown as DataSource;

    const result = await new TypeOrmTransactionManager(mockDataSource).run(async () => 42);

    expect(result).toBe(42);
  });
});
