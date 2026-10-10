import { getAuthToken } from './auth';

const base = process.env.EXPO_PUBLIC_API_URL;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!base) throw new Error('API-adressen er ikke konfigurert ennå.');

  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${await getAuthToken()}`);

  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${base}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({ message: 'Ugyldig svar fra serveren' }));

  if (!response.ok) throw new Error(body.message ?? 'Forespørselen kunne ikke fullføres.');
  return body as T;
}
