import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export default async function globalTeardown(): Promise<void> {
  const container = (globalThis as Record<string, unknown>)['__TC_PG_CONTAINER__'] as
    | StartedPostgreSqlContainer
    | undefined;

  if (container) {
    await container.stop();
  }
}
