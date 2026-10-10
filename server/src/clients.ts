import { S3Client } from '@aws-sdk/client-s3';
import { neon } from '@neondatabase/serverless';
import twilio from 'twilio';
import { env } from './config.js';

export const db = neon(env.DATABASE_URL);
export const storage = new S3Client({
  endpoint: env.NEON_STORAGE_ENDPOINT,
  region: env.NEON_STORAGE_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.NEON_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.NEON_STORAGE_SECRET_ACCESS_KEY,
  },
});
export const twilioClient = twilio(env.TWILIO_API_KEY, env.TWILIO_API_SECRET, {
  accountSid: env.TWILIO_ACCOUNT_SID,
});
