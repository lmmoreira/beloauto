import 'reflect-metadata';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { HotsiteConfigEntity } from '../contexts/platform/infrastructure/entities/hotsite-config.entity';
import { TenantEntity } from '../contexts/platform/infrastructure/entities/tenant.entity';
import { CreatePlatformHotsiteConfigs1716500000002 } from '../contexts/platform/infrastructure/migrations/1716500000002-CreatePlatformHotsiteConfigs';
import { CreatePlatformTenants1716500000001 } from '../contexts/platform/infrastructure/migrations/1716500000001-CreatePlatformTenants';

export default async function globalSetup(): Promise<void> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:15-alpine',
  ).start();

  process.env['TEST_DATABASE_URL'] = container.getConnectionUri();

  // Stored in global so globalTeardown (same main process) can stop it
  (global as Record<string, unknown>)['__TC_PG_CONTAINER__'] = container;

  // Run migrations once for the entire test run
  const ds = new DataSource({
    type: 'postgres',
    url: container.getConnectionUri(),
    entities: [TenantEntity, HotsiteConfigEntity],
    migrations: [CreatePlatformTenants1716500000001, CreatePlatformHotsiteConfigs1716500000002],
    synchronize: false,
    migrationsRun: false,
  });

  await ds.initialize();
  await ds.query(`CREATE SCHEMA IF NOT EXISTS "platform"`);
  await ds.runMigrations();
  await ds.destroy();
}
