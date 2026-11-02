import { Router } from 'express';
import { z } from 'zod';
import { db } from './clients.js';
import { asyncRoute } from './http.js';
import { selectProvider } from './telnyx-provider.js';
export const pbx = Router();
const schema=z.object({
 business_name:z.string().trim().min(1).max(100),
 provider:z.enum(['twilio','telnyx']),
 welcome_message:z.string().trim().min(1).max(400),
 open_from:z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/),
 open_to:z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/),
 closed_message:z.string().trim().min(1).max(400),
 fallback_number:z.union([z.string().regex(/^\\+[1-9]\\d{6,14}$/),z.null()]),
 enabled:z.boolean()
});
pbx.get('/dashboard',asyncRoute(async(req,res)=>{
 const uid=req.userId!;
 const [settings,extensions,calls,numbers]=await Promise.all([
  db.query('SELECT * FROM phone.pbx_settings WHERE user_id=$1',[uid]),
  db.query('SELECT id,name,extension,destination,enabled FROM phone.pbx_extensions WHERE user_id=$1 ORDER BY extension',[uid]),
  db.query('SELECT call_sid,status,from_number,to_number,updated_at FROM phone.call_events WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 30',[uid]),
  db.query('SELECT phone_number,capabilities FROM phone.phone_numbers WHERE user_id=$1 AND status=$2',[uid,'active'])
 ]);
 res.json({settings:settings.rows[0]??null,extensions:extensions.rows,calls:calls.rows,numbers:numbers.rows,telnyxConfigured:!!process.env.TELNYX_API_KEY});
}));
pbx.put('/settings',asyncRoute(async(req,res)=>{
 const parsed=schema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({message:'Invalid PBX configuration',issues:parsed.error.issues});
 const p=parsed.data;
 if(p.provider==='telnyx' && !process.env.TELNYX_API_KEY) return res.status(409).json({message:'Configure TELNYX_API_KEY first'});
 const q=await db.query(`INSERT INTO phone.pbx_settings(user_id,business_name,provider,welcome_message,open_from,open_to,closed_message,fallback_number,enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id) DO UPDATE SET business_name=EXCLUDED.business_name,provider=EXCLUDED.provider,welcome_message=EXCLUDED.welcome_message,open_from=EXCLUDED.open_from,open_to=EXCLUDED.open_to,closed_message=EXCLUDED.closed_message,fallback_number=EXCLUDED.fallback_number,enabled=EXCLUDED.enabled,updated_at=now() RETURNING *`,[req.userId,p.business_name,selectProvider(p.provider,!!process.env.TELNYX_API_KEY),p.welcome_message,p.open_from,p.open_to,p.closed_message,p.fallback_number,p.enabled]);
 res.json({settings:q.rows[0]});
}));
const extSchema=z.object({name:z.string().trim().min(1).max(80),extension:z.string().regex(/^\d{2,6}$/),destination:z.string().regex(/^\+[1-9]\d{6,14}$/)});
pbx.post('/extensions',asyncRoute(async(req,res)=>{
 const p=extSchema.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid extension'});
 const q=await db.query('INSERT INTO phone.pbx_extensions(user_id,name,extension,destination) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,extension) DO UPDATE SET name=EXCLUDED.name,destination=EXCLUDED.destination RETURNING id,name,extension,destination,enabled',[req.userId,p.data.name,p.data.extension,p.data.destination]);
 res.status(201).json({extension:q.rows[0]});
}));
pbx.delete('/extensions/:id',asyncRoute(async(req,res)=>{
 const q=await db.query('DELETE FROM phone.pbx_extensions WHERE user_id=$1 AND id=$2 RETURNING id',[req.userId,req.params.id]);
 res.status(q.rowCount?204:404).end();
}));
