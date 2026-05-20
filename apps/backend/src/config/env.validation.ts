import { z } from 'zod';
import { config } from 'dotenv';

config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DB_HOST: z.string().min(1, { message: 'DB_HOST is required' }),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().min(1, { message: 'DB_USER is required' }),
  DB_PASSWORD: z.string().min(1, { message: 'DB_PASSWORD is required' }),
  DB_NAME: z.string().min(1, { message: 'DB_NAME is required' }),
  PLATFORM_ADMIN_KEY: z
    .string()
    .min(32, { message: 'PLATFORM_ADMIN_KEY must be at least 32 characters' }),
  PUBSUB_EMULATOR_HOST: z.string().optional(),
  PUBSUB_PROJECT_ID: z.string().default('beloauto-local'),
  GCS_EMULATOR_HOST: z.string().optional(),
  GCS_BUCKET_NAME: z.string().default('beloauto-local'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default('noreply@beloauto.com.br'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(): Env {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    process.stderr.write(`\n❌ ENV validation failed:\n${errors}\n\n`);
    process.exit(1);
  }

  return result.data;
}
