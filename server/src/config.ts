import { z } from 'zod';

const required = [
  'DATABASE_URL',
  'NEON_AUTH_BASE_URL',
  'NEON_STORAGE_ENDPOINT',
  'NEON_STORAGE_REGION',
  'NEON_STORAGE_BUCKET',
  'NEON_STORAGE_ACCESS_KEY_ID',
  'NEON_STORAGE_SECRET_ACCESS_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_API_KEY',
  'TWILIO_API_SECRET',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_TWIML_APP_SID',
  'TWILIO_CALLER_ID',
] as const;

export const missingLiveConfig = required.filter(key => !process.env[key]);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  PUBLIC_BASE_URL: z.string().url().default('https://vedoy-phone-api.vercel.app'),
  APP_ORIGINS: z.string().default('vedoyphone://,https://vedoy-phone.vercel.app,https://vedoy-dev-portal.vercel.app'),
  DATABASE_URL: z.string().min(1).default('postgresql://missing:missing@localhost:5432/missing?sslmode=require'),
  NEON_AUTH_BASE_URL: z.string().url().default('https://missing.neonauth.invalid/neondb/auth'),
  NEON_STORAGE_ENDPOINT: z.string().url().default('https://missing.storage.invalid'),
  NEON_STORAGE_REGION: z.string().min(1).default('eu-central-1'),
  NEON_STORAGE_BUCKET: z.string().min(1).default('uploads'),
  NEON_STORAGE_ACCESS_KEY_ID: z.string().min(1).default('missing'),
  NEON_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).default('missing'),
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').default('AC00000000000000000000000000000000'),
  TWILIO_API_KEY: z.string().startsWith('SK').default('SK00000000000000000000000000000000'),
  TWILIO_API_SECRET: z.string().min(1).default('missing'),
  TWILIO_AUTH_TOKEN: z.string().min(1).default('missing'),
  TWILIO_TWIML_APP_SID: z.string().startsWith('AP').default('AP00000000000000000000000000000000'),
  TWILIO_CALLER_ID: z.string().regex(/^\+[1-9]\d{6,14}$/).default('+4700000000'),
  TWILIO_MESSAGING_SERVICE_SID: z.string().startsWith('MG').optional(),
  TWILIO_IOS_PUSH_CREDENTIAL_SID: z.string().startsWith('CR').optional(),
  TWILIO_ANDROID_PUSH_CREDENTIAL_SID: z.string().startsWith('CR').optional(),
  VOICE_ALLOWED_COUNTRIES: z.string().default('NO,SE,DK,FI,GB,US'),
  SMS_ALLOWED_COUNTRIES: z.string().default('NO,SE,DK,FI,GB,US'),
  MAX_NUMBERS_PER_USER: z.coerce.number().int().min(1).max(50).default(5),
  MAX_SMS_PER_MINUTE: z.coerce.number().int().min(1).default(20),
  MAX_NUMBER_SEARCH_RESULTS: z.coerce.number().int().min(1).max(100).default(30),
});

export const env = schema.parse(process.env);
