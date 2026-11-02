import { Router } from 'express';
import { z } from 'zod';
import { phoneDb as db } from './database.js';
import { asyncRoute, e164 } from './http.js';
export const orders = Router();
const draftSchema = z.object({
  restaurantNumber: z.string().refine(e164),
  customerNumber: z.string().refine(e164).optional(),
  source: z.enum(['sms','phone','app','wolt','foodora']),
  externalId: z.string().min(1).max(150),
  text: z.string().trim().min(1).max(2000)
});
/** Only drafts: never calculate a price or send to a kitchen from AI input. */
orders.post('/drafts', asyncRoute(async(req,res)=>{
  const p=draftSchema.safeParse(req.body);
  if(!p.success)return res.status(400).json({message:'Invalid order draft'});
  const {data:line,error:lineError}=await db.from('restaurant_lines').select('phone_number').eq('user_id',req.userId!).eq('phone_number',p.data.restaurantNumber).eq('enabled',true).maybeSingle();
  if(lineError)throw lineError;
  if(!line)return res.status(403).json({message:'Restaurant line is not enabled'});
  const {data,error}=await db.from('restaurant_order_drafts').upsert({
    user_id:req.userId,restaurant_number:p.data.restaurantNumber,
    customer_number:p.data.customerNumber??null,source:p.data.source,
    external_id:p.data.externalId,original_text:p.data.text,status:'needs_review'
  },{onConflict:'restaurant_number,source,external_id',ignoreDuplicates:true}).select('id,status,source,created_at').maybeSingle();
  if(error)throw error;
  res.status(202).json({draft:data??null,status:'needs_review'});
}));
orders.get('/drafts',asyncRoute(async(req,res)=>{
  const {data,error}=await db.from('restaurant_order_drafts')
    .select('id,restaurant_number,source,original_text,items,status,created_at')
    .eq('user_id',req.userId!).order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  res.json({drafts:data??[]});
}));
