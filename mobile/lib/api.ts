import { getAuthCookie } from './auth';
const base = process.env.EXPO_PUBLIC_API_URL;
export async function api<T>(path:string, init:RequestInit = {}):Promise<T> {
  if (!base) throw new Error('API-adressen er ikke konfigurert ennå.');
  const cookie=await getAuthCookie();
  const isForm=typeof FormData!=='undefined'&&init.body instanceof FormData;
  const response = await fetch(`${base}${path}`, { ...init, headers:{...(isForm?{}:{'Content-Type':'application/json'}), ...(cookie?{Cookie:cookie}:{}), ...init.headers} });
  const body = await response.json().catch(()=>({message:'Ugyldig svar fra serveren'}));
  if (!response.ok) throw new Error(body.message ?? 'Forespørselen kunne ikke fullføres.');
  return body as T;
}
