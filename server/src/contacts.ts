import {Router} from 'express';
import {z} from 'zod';
import {db} from './clients.js';
import {asyncRoute} from './http.js';

export const contacts=Router();
const phone=z.string().regex(/^\+[1-9]\d{6,14}$/,'Bruk internasjonalt nummer (+47...).');
const shape=z.object({
  full_name:z.string().trim().min(1).max(120),
  phone_number:phone,
  email:z.union([z.email().max(254),z.literal('')]).optional(),
  company:z.string().trim().max(120).optional(),
  notes:z.string().max(1000).optional(),
  favorite:z.boolean().default(false)
});
const patch=shape.partial().refine(x=>Object.keys(x).length>0);
function bad(res:import('express').Response){return res.status(400).json({message:'Kontroller navn og nummer (+47...).'});}
contacts.get('/',asyncRoute(async(req,res)=>{
 const search=String(req.query.q??'').trim().slice(0,80);
 const params:unknown[]=[req.userId];
 let query='SELECT id,full_name,phone_number,email,company,notes,favorite,updated_at FROM phone.contacts WHERE user_id=$1';
 if(search){params.push('%'+search.replace(/[\\%_]/g,'\\$&')+'%');query+=" AND (full_name ILIKE $2 ESCAPE '\\' OR phone_number ILIKE $2 ESCAPE '\\')";}
 const result=await db.query(query+' ORDER BY favorite DESC,full_name ASC LIMIT 500',params);
 res.json({contacts:result.rows});
}));
contacts.post('/',asyncRoute(async(req,res)=>{
 const p=shape.safeParse(req.body);if(!p.success)return bad(res);
 const c=p.data;
 const result=await db.query('INSERT INTO phone.contacts(user_id,full_name,phone_number,email,company,notes,favorite) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[req.userId,c.full_name,c.phone_number,c.email||null,c.company||null,c.notes||null,c.favorite]);
 res.status(201).json({contact:result.rows[0]});
}));
contacts.patch('/:id',asyncRoute(async(req,res)=>{
 const p=patch.safeParse(req.body);if(!p.success)return bad(res);
 const keys=Object.keys(p.data) as (keyof typeof p.data)[];
 const params:unknown[]=[req.userId,req.params.id];
 const sets=keys.map((key,i)=>{params.push(p.data[key]);return '"'+key+'"=$'+(i+3);});
 const result=await db.query('UPDATE phone.contacts SET '+sets.join(',')+',updated_at=now() WHERE user_id=$1 AND id=$2::uuid RETURNING *',params);
 if(!result.rows.length)return res.status(404).json({message:'Kontakten finnes ikke.'});
 res.json({contact:result.rows[0]});
}));
contacts.delete('/:id',asyncRoute(async(req,res)=>{
 const result=await db.query('DELETE FROM phone.contacts WHERE user_id=$1 AND id=$2::uuid RETURNING id',[req.userId,req.params.id]);
 if(!result.rows.length)return res.status(404).json({message:'Kontakten finnes ikke.'});
 res.sendStatus(204);
}));
