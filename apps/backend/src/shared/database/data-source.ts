import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config(); // load .env when invoked directly by TypeORM CLI

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'],
  port: Number(process.env['DB_PORT'] ?? 5432),
  username: process.env['DB_USER'],
  password: process.env['DB_PASSWORD'],
  database: process.env['DB_NAME'],
  synchronize: false,
  migrationsRun: false,
  logging: process.env['NODE_ENV'] === 'development' ? ['query', 'error'] : ['error'],
  entities: [__dirname + '/../../contexts/**/infrastructure/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../../contexts/**/infrastructure/migrations/*{.ts,.js}'],
  subscribers: [],
});
