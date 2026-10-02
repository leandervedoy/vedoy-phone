import type {Request,Response,NextFunction} from 'express';
import twilio from 'twilio';
import {parsePhoneNumberFromString} from 'libphonenumber-js';
import {env} from './config.js';
export function validateTwilio(req:Request,res:Response,next:NextFunction){const signature=req.header('X-Twilio-Signature')??'';const url=`${env.PUBLIC_BASE_URL.replace(/\/$/,'')}${req.originalUrl}`;const valid=twilio.validateRequest(env.TWILIO_AUTH_TOKEN,signature,url,req.body??{});if(!valid)return res.status(403).send('Invalid Twilio signature');next()}
export function asyncRoute(fn:(req:Request,res:Response)=>Promise<unknown>){return (req:Request,res:Response,next:NextFunction)=>{Promise.resolve(fn(req,res)).catch(next)}}
export function e164(input:unknown):input is string{return typeof input==='string'&&/^\+[1-9]\d{6,14}$/.test(input)}
export function destinationAllowed(number:string,csv:string){const country=parsePhoneNumberFromString(number)?.country;return !!country&&csv.split(',').map(x=>x.trim().toUpperCase()).includes(country)}
