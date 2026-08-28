import { resolve } from 'node:path';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),

  STORAGE_DRIVER: z.enum(['json']).default('json'),
  DATA_FILE: z.string().default('data/servicedesk.json'),
  SEED_FILE: z.string().default('data/seed.json'),
  // Unused by the JSON driver; kept so the database driver can be enabled
  // without reshaping configuration.
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
  ALLOW_EXTERNAL_SELF_REGISTRATION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  storage: {
    driver: 'json';
    dataFile: string;
    seedFile: string;
  };
  databaseUrl: string | null;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  corsOrigins: string[];
  allowExternalSelfRegistration: boolean;
};

export function loadConfiguration(): AppConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  const env = parsed.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.API_PORT,
    storage: {
      driver: env.STORAGE_DRIVER,
      dataFile: resolve(process.cwd(), env.DATA_FILE),
      seedFile: resolve(process.cwd(), env.SEED_FILE),
    },
    databaseUrl: env.DATABASE_URL ?? null,
    redisUrl: env.REDIS_URL,
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowExternalSelfRegistration: env.ALLOW_EXTERNAL_SELF_REGISTRATION,
  };
}
