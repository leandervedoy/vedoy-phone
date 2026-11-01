import {Router} from 'express';
import type {Request} from 'express';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {db} from './clients.js';
import {asyncRoute} from './http.js';

export const auditRouter=Router();
export async function auditEventInTx(client:PoolClient,req:Request,action:string,organizationId:string,targetType:string,targetId:string,details:Record<string,unknown>={}){
 if(!req.userId)throw new Error('Audit requires an authenticated actor');
 // Do not log secrets, call content, phone numbers, emails or raw payloads.
 await client.query('INSERT INTO phone.audit_events(organization_id,actor_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
 [organizationId,req.userId,action,targetType,targetId,JSON.stringify(details)]);
}
auditRouter.get('/organizations/:organizationId',asyncRoute(async(req,res)=>{
 const org=z.string().uuid().safeParse(req.params.organizationId);
 if(!org.success)return res.sendStatus(400);
 const membership=await db.query("SELECT role FROM phone.organization_members WHERE organization_id=$1 AND user_id=$2 AND role IN ('owner','admin')",[org.data,req.userId]);
 if(!membership.rows.length)return res.sendStatus(404);
 const limit=z.coerce.number().int().min(1).max(100).default(50).safeParse(req.query.limit);
 const before=z.iso.datetime({offset:true}).optional().safeParse(req.query.before);
 if(!limit.success||!before.success)return res.status(400).json({message:'Ugyldig sideinndeling.'});
 const params=[org.data,before.data??new Date().toISOString(),limit.data];
 const rows=await db.query('SELECT id,actor_id,action,target_type,target_id,details,created_at FROM phone.audit_events WHERE organization_id=$1 AND created_at<$2::timestamptz ORDER BY created_at DESC,id DESC LIMIT $3',params);
 res.set('Cache-Control','no-store').json({events:rows.rows,has_more:rows.rows.length===limit.data});
}));
