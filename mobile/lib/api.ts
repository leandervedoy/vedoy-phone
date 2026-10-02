import { supabase } from './supabase';
const base = process.env.EXPO_PUBLIC_API_URL;
export async function api<T>(path:string, init:RequestInit = {}):Promise<T> {
  if (!base) throw new Error('API-adressen er ikke konfigurert ennå.');
  const { data } = await supabase?.auth.getSession() ?? {data:{session:null}};
  const response = await fetch(`${base}${path}`, { ...init, headers:{'Content-Type':'application/json', ...(data.session?.access_token ? {Authorization:`Bearer ${data.session.access_token}`} : {}), ...init.headers} });
  const body = await response.json().catch(()=>({message:'Ugyldig svar fra serveren'}));
  if (!response.ok) throw new Error(body.message ?? 'Forespørselen kunne ikke fullføres.');
  return body as T;
}
