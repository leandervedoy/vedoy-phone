import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';
import { env } from './config.js';
export const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
export const publicAuth=createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
export const twilioClient=twilio(env.TWILIO_API_KEY,env.TWILIO_API_SECRET,{accountSid:env.TWILIO_ACCOUNT_SID});
