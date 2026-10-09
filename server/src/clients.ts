import twilio from 'twilio';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from './config.js';

export const db = new Pool({ connectionString: env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8_000, options: '-c search_path=phone,public' });
export const s3 = new S3Client({region:env.AWS_REGION,endpoint:env.AWS_ENDPOINT_URL_S3,forcePathStyle:true,...(env.AWS_ACCESS_KEY_ID&&env.AWS_SECRET_ACCESS_KEY?{credentials:{accessKeyId:env.AWS_ACCESS_KEY_ID,secretAccessKey:env.AWS_SECRET_ACCESS_KEY}}:{})});
export const twilioClient=twilio(env.TWILIO_API_KEY,env.TWILIO_API_SECRET,{accountSid:env.TWILIO_ACCOUNT_SID});
