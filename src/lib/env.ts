import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().default('http://localhost:3001'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // CORS
  PODS_APP_WHITELIST: z.string().transform((val) => val.split(';').filter(Boolean)),

  // Database
  DATABASE_URL: z.string(),

  // MinIO
  MINIO_ENDPOINT: z.string(),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.string().transform((val) => val === 'true').default('false'),
  MINIO_ROOT_USER: z.string(),
  MINIO_ROOT_PASSWORD: z.string(),
  MINIO_BUCKET_NAME: z.string().default('minidrive-files'),

  // Security & Encryption
  MASTER_ENCRYPTION_KEY: z.string().min(32),
  SESSION_SECRET: z.string().min(16),
  SESSION_EXPIRY_HOURS: z.coerce.number().default(168), // 7 days

  // WebAuthn
  WEBAUTHN_RP_NAME: z.string().default('MiniDrive'),
  WEBAUTHN_RP_ID: z.string(),
  WEBAUTHN_ORIGIN: z.string(),
});

export const ENV = envSchema.parse(process.env);

export type EnvConfig = z.infer<typeof envSchema>;

// Export whitelist for CORS
export const APP_WHITELIST = ENV.PODS_APP_WHITELIST;
