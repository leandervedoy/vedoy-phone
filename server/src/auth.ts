import type {Request,Response,NextFunction} from 'express';
import {publicAuth} from './clients.js';
declare global {namespace Express {interface Request {userId?:string;authToken?:string;isAdmin?:boolean}}}
export async function requireAuth(req:Request,res:Response,next:NextFunction){try{const h=req.header('authorization');if(!h?.startsWith('Bearer '))return res.status(401).json({message:'Logg inn for å fortsette.'});const token=h.slice(7);const {data,error}=await publicAuth.auth.getUser(token);if(error||!data.user)return res.status(401).json({message:'Økten er utløpt.'});req.userId=data.user.id;req.isAdmin=data.user.app_metadata?.role==='admin';req.authToken=token;next()}catch{return res.status(401).json({message:'Kunne ikke validere økten.'})}}
