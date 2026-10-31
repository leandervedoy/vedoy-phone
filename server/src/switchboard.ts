import {Router} from 'express';
import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {db} from './clients.js';
import {asyncRoute} from './http.js';

export const switchboard=Router();
const id=z.string().uuid();
const number=z.string().regex(/^\+[1-9]\d{6,14}$/);
const org=z.object({name:z.string().trim().min(2).max(160),organization_type:z.enum(['ENK','AS','ASA','ANS','DA','SA','NUF','STIFTELSE','FORENING','ANNET']),organization_number:z.string().regex(/^\d{9}$/).optional()});
const settings=z.object({greeting:z.string().trim().min(1).max(240),forwarding_number:number.nullable(),fallback_number:number.nullable(),opening_hour:z.number().int().min(0).max(23),closing_hour:z.number().int().min(1).max(24),enabled:z.boolean()}).refine(x=>x.closing_hour>x.opening_hour);
async function access(orgId:string,userId:string,roles?:string[]){
 const r=await db.query('SELECT role FROM phone.organization_members WHERE organization_id=$1 AND user_id=$2',[orgId,userId]);
 const role=r.rows[0]?.role as string|undefined;
 return role && (!roles||roles.includes(role))?role:null;
}
switchboard.get('/',asyncRoute(async(req,res)=>{
 const r=await db.query('SELECT o.id,o.name,o.organization_type,o.organization_number,o.verified,m.role FROM phone.organizations o JOIN phone.organization_members m ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.created_at DESC',[req.userId]);res.json({organizations:r.rows});
}));
switchboard.post('/',asyncRoute(async(req,res)=>{
 const p=org.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Velg foretaksform, navn og eventuelt gyldig organisasjonsnummer.'});
 const client=await db.connect();
 try{await client.query('BEGIN');
 const r=await client.query('INSERT INTO phone.organizations(name,organization_type,organization_number,owner_id) VALUES($1,$2,$3,$4) RETURNING id,name,organization_type,verified',[p.data.name,p.data.organization_type,p.data.organization_number??null,req.userId]);
 const orgId=r.rows[0].id;
 await client.query("INSERT INTO phone.organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",[orgId,req.userId]);
 await client.query('INSERT INTO phone.switchboard_settings(organization_id) VALUES($1)',[orgId]);
 await client.query('COMMIT');res.status(201).json({organization:r.rows[0]});
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}));
switchboard.get('/:id',asyncRoute(async(req,res)=>{
 const orgId=String(req.params.id);if(!id.safeParse(orgId).success)return res.sendStatus(400);
 const role=await access(orgId,req.userId!);if(!role)return res.sendStatus(404);
 const [o,s,m]=await Promise.all([
  db.query('SELECT id,name,organization_type,organization_number,verified FROM phone.organizations WHERE id=$1',[orgId]),
  db.query('SELECT greeting,forwarding_number,fallback_number,opening_hour,closing_hour,timezone,enabled,updated_at FROM phone.switchboard_settings WHERE organization_id=$1',[orgId]),
  db.query('SELECT user_id,role,created_at FROM phone.organization_members WHERE organization_id=$1 ORDER BY created_at',[orgId])
 ]);
 res.json({organization:o.rows[0],settings:s.rows[0],members:m.rows,role});
}));
switchboard.patch('/:id',asyncRoute(async(req,res)=>{
 const orgId=String(req.params.id);if(!id.safeParse(orgId).success)return res.sendStatus(400);
 if(!await access(orgId,req.userId!,['owner','admin']))return res.sendStatus(403);
 const p=settings.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Ugyldig ringeflyt. Kontroller nummer og åpningstider.'});
 const s=p.data;
 const r=await db.query(`UPDATE phone.switchboard_settings SET greeting=$2,forwarding_number=$3,fallback_number=$4,opening_hour=$5,closing_hour=$6,enabled=$7,updated_at=now() WHERE organization_id=$1 RETURNING *`,[orgId,s.greeting,s.forwarding_number,s.fallback_number,s.opening_hour,s.closing_hour,s.enabled]);
 res.json({settings:r.rows[0],note:'Innstillingene er lagret. Aktiv trafikkruting krever tilknyttet, verifisert Telnyx-linje.'});
}));
switchboard.post('/:id/invitations',asyncRoute(async(req,res)=>{
 const orgId=String(req.params.id);if(!id.safeParse(orgId).success)return res.sendStatus(400);
 if(!await access(orgId,req.userId!,['owner','admin']))return res.sendStatus(403);
 const p=z.object({email:z.email().max(254),role:z.enum(['admin','agent','viewer'])}).safeParse(req.body);
 if(!p.success)return res.sendStatus(400);
 const token=randomBytes(24).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
 await db.query('INSERT INTO phone.organization_invitations(organization_id,email,role,token_hash,created_by) VALUES($1,$2,$3,$4,$5)',[orgId,p.data.email.toLowerCase(),p.data.role,hash,req.userId]);
 // Invitation must be delivered by a separate trusted channel; not emailed automatically.
 res.status(201).json({invite_code:token,expires_in_days:7});
}));
switchboard.post('/invitations/accept',asyncRoute(async(req,res)=>{
 const p=z.object({invite_code:z.string().min(24).max(100)}).safeParse(req.body);if(!p.success)return res.sendStatus(400);
 if(!req.userEmail)return res.status(403).json({message:'Verifisert e-post er påkrevd.'});
 const hash=createHash('sha256').update(p.data.invite_code).digest('hex');
 const client=await db.connect();
 try{
 await client.query('BEGIN');
 const r=await client.query('SELECT id,organization_id,role,email FROM phone.organization_invitations WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL FOR UPDATE',[hash]);
 const invite=r.rows[0];
 if(!invite||invite.email.toLowerCase()!==req.userEmail.toLowerCase()){await client.query('ROLLBACK');return res.status(403).json({message:'Invitasjonen er ugyldig eller knyttet til en annen e-post.'});}
 await client.query('INSERT INTO phone.organization_members(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[invite.organization_id,req.userId,invite.role]);
 await client.query('UPDATE phone.organization_invitations SET accepted_at=now() WHERE id=$1',[invite.id]);
 await client.query('COMMIT');res.json({organization_id:invite.organization_id});
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}));
switchboard.delete('/:id/members/:userId',asyncRoute(async(req,res)=>{
 const orgId=String(req.params.id);if(!id.safeParse(orgId).success)return res.sendStatus(400);
 if(!await access(orgId,req.userId!,['owner']))return res.sendStatus(403);
 const target=String(req.params.userId);
 const r=await db.query("DELETE FROM phone.organization_members WHERE organization_id=$1 AND user_id=$2 AND role<>'owner' RETURNING user_id",[orgId,target]);
 if(!r.rows.length)return res.sendStatus(404);res.sendStatus(204);
}));
