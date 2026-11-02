/** Telnyx optional provider adapter. Secrets never enter a client bundle. */
const endpoint = 'https://api.telnyx.com/v2';
export type Provider = 'twilio' | 'telnyx';
export function selectProvider(preference: Provider, telnyxEnabled: boolean): Provider {
  return preference === 'telnyx' && telnyxEnabled ? 'telnyx' : 'twilio';
}
export async function telnyxRequest<T>(path: string, init: {method?: 'GET'|'POST'; body?: unknown} = {}): Promise<T> {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error('TELNYX_API_KEY not configured');
  if (!/^\/[a-z0-9/_-]+$/i.test(path)) throw new Error('Invalid Telnyx API path');
  const response = await fetch(endpoint + path, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(init.body === undefined ? {} : {body: JSON.stringify(init.body)}),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Telnyx API responded ${response.status}`);
  return response.json() as Promise<T>;
}
export async function telnyxDial(to: string, from: string, connectionId: string) {
  if (!/^\+[1-9]\d{6,14}$/.test(to) || !/^\+[1-9]\d{6,14}$/.test(from)) throw new Error('Invalid E.164 phone number');
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) throw new Error('Invalid Telnyx connection');
  return telnyxRequest('/calls', {method:'POST',body:{connection_id:connectionId,to,from}});
}
