import { z } from 'zod';
import { config } from 'dotenv';

config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }),
  PLATFORM_ADMIN_KEY: z
    .string()
    .min(32, { message: 'PLATFORM_ADMIN_KEY must be at least 32 characters' }),
  PUBSUB_EMULATOR_HOST: z.string().optional(),
  PUBSUB_PROJECT_ID: z.string().default('beloauto-local'),
  GCS_EMULATOR_HOST: z.string().optional(),
  GCS_BUCKET_NAME: z.string().default('beloauto-local'),
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
