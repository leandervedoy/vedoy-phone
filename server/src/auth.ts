import type {Request,Response,NextFunction} from 'express';
import { env } from './config.js';
declare global {namespace Express {interface Request {userId?:string;authToken?:string;isAdmin?:boolean}}}
export async function requireAuth(req:Request,res:Response,next:NextFunction){
  try {
    const authorization=req.header('authorization');
    const cookie=req.header('cookie')??(authorization?.startsWith('Bearer ')?authorization.slice(7):'');
    if(!cookie)return res.status(401).json({message:'Logg inn for å fortsette.'});
    const session=await fetch(`${env.NEON_AUTH_BASE_URL.replace(/\/$/,'')}/get-session`,{headers:{cookie,accept:'application/json'},signal:AbortSignal.timeout(5000)});
    if(!session.ok)return res.status(401).json({message:'Økten er utløpt.'});
    const payload=await session.json() as {user?:{id?:string;email?:string;role?:string;app_metadata?:{role?:string}}};
    const user=payload.user;
    if(!user?.id)return res.status(401).json({message:'Økten er utløpt.'});
    req.userId=user.id;
    req.isAdmin=!!user.email&&env.ADMIN_EMAILS.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase());
    req.authToken=cookie;
    next();
  } catch { return res.status(401).json({message:'Kunne ikke validere økten.'}); }
}
