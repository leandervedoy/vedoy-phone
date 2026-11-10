import { Router, type Response } from 'express';
import { z } from 'zod';
import twilio from 'twilio';
import { db } from './clients.js';
import { env } from './config.js';
import { asyncRoute, validateTwilio } from './http.js';
import { clientIdentity } from './identity.js';
import { canDialPbx, MAX_PBX_SELECTIONS_PER_NUMBER_PER_DAY, MAX_PBX_RING_SECONDS, MAX_PBX_CALL_SECONDS } from './pbx-policy.js';

/**
 * PBX MVP: a single number/menu per authenticated owner, with DTMF routing
 * to that owner's Twilio Voice SDK client. Department-specific agents,
 * outbound forwarding, billing and customer tenants are deliberately not enabled.
 *
 * IVR flow follows Twilio's official Node.js Express <Gather>/<Say>/<Dial> example.
 */
const departmentSchema = z.object({
  digit: z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9']),
  label: z.string().trim().min(2).max(48),
});
export const menuSchema = z.object({
  number: z.string().regex(/^\+[1-9]\d{6,14}$/),
  enabled: z.boolean(),
  greeting: z.string().trim().min(3).max(240),
  departments: z.array(departmentSchema).min(1).max(5),
}).superRefine((value, context) => {
  const digits = value.departments.map(d => d.digit);
  if (new Set(digits).size !== digits.length) {
    context.addIssue({ code: 'custom', message: 'Each department needs a unique digit.', path: ['departments'] });
  }
});
type Menu = z.infer<typeof menuSchema> & { userId: string };

export const pbxAdmin = Router();
export const pbxWebhook = Router();
const base = env.PUBLIC_BASE_URL.replace(/\/$/, '');
const sayOptions = { language: 'nb-NO' as const, voice: 'Polly.Liv' as const };

pbxAdmin.get('/config', asyncRoute(async (req, res) => {
  const result = await db.query(
    'SELECT phone_number, enabled, greeting, departments, updated_at FROM phone.pbx_menus WHERE user_id=$1 LIMIT 1',
    [req.userId!],
  );
  const row = result.rows[0];
  res.json({ config: row ? {
    number: row.phone_number, enabled: row.enabled, greeting: row.greeting,
    departments: row.departments, updatedAt: row.updated_at,
  } : null });
}));

pbxAdmin.put('/config', asyncRoute(async (req, res) => {
  const input = menuSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({
    message: 'Ugyldig sentralbordoppsett.',
    details: input.error.issues.map(i => i.message),
  });
  // Only configure a number that is ACTIVE, Voice capable and owned by this user.
  const owned = await db.query(
    "SELECT id FROM phone.phone_numbers WHERE user_id=$1 AND phone_number=$2 AND status='active' AND capabilities->>'voice'='true' LIMIT 1",
    [req.userId!, input.data.number],
  );
  if (!owned.rowCount) return res.status(403).json({
    message: 'Du må eie et aktivt Twilio-nummer med Voice-støtte.',
  });
  const { number, enabled, greeting, departments } = input.data;
  await db.query(
    'INSERT INTO phone.pbx_menus(user_id,phone_number,enabled,greeting,departments) VALUES($1,$2,$3,$4,$5::jsonb) ' +
    'ON CONFLICT(user_id) DO UPDATE SET phone_number=EXCLUDED.phone_number,enabled=EXCLUDED.enabled,' +
    'greeting=EXCLUDED.greeting,departments=EXCLUDED.departments,updated_at=now()',
    [req.userId!, number, enabled, greeting, JSON.stringify(departments)],
  );
  res.json({ saved: true, enabled, number });
}));

async function activeMenu(number: string): Promise<Menu | null> {
  let result;
  try {
    result = await db.query(
      "SELECT p.user_id,p.phone_number,p.enabled,p.greeting,p.departments FROM phone.pbx_menus p " +
      "JOIN phone.phone_numbers n ON n.user_id=p.user_id AND n.phone_number=p.phone_number " +
      "WHERE p.phone_number=$1 AND p.enabled=true AND n.status='active' " +
      "AND n.capabilities->>'voice'='true' LIMIT 1",
      [number],
    );
  } catch (error) {
    // During a staged rollout the optional PBX migration might not exist yet.
    // Fail open ONLY for missing table/schema; never swallow other database failures.
    if ((error as {code?: string})?.code === '42P01' || (error as {code?: string})?.code === '3F000') return null;
    throw error;
  }
  const row = result.rows[0];
  if (!row) return null;
  const checked = menuSchema.safeParse({
    number: row.phone_number, enabled: row.enabled, greeting: row.greeting,
    departments: row.departments,
  });
  if (!checked.success) throw new Error('PBX configuration is invalid');
  return { ...checked.data, userId: row.user_id };
}

function sendXml(res: Response, response: twilio.twiml.VoiceResponse): void {
  res.type('text/xml').send(response.toString());
}

/** If no PBX is enabled, callers continue through the existing Vedoy Phone flow. */
export async function maybeHandlePbxInbound(number: string, res: Response): Promise<boolean> {
  const menu = await activeMenu(number);
  if (!menu) return false;
  const response = new twilio.twiml.VoiceResponse();
  const gather = response.gather({
    action: base + '/webhooks/twilio/voice/pbx-menu',
    method: 'POST',
    input: ['dtmf'],
    timeout: 7,
    numDigits: 1,
    actionOnEmptyResult: true,
  });
  gather.say(sayOptions, menu.greeting);
  for (const department of menu.departments) {
    gather.say(sayOptions, 'Trykk ' + department.digit + ' for ' + department.label + '.');
  }
  sendXml(res, response);
  return true;
}

/** Only Twilio-signed DTMF callbacks can advance a call. */
/** DTMF callbacks must be signed, valid, unique per CallSid and within a daily quota.
 * A transaction-level advisory lock serializes quota decisions for each destination.
 * The database is intentionally the idempotency gate: retries MUST NOT dial twice.
 */
pbxWebhook.post('/pbx-menu', validateTwilio, asyncRoute(async (req, res) => {
  const to = typeof req.body.To === 'string' ? req.body.To : '';
  const digit = typeof req.body.Digits === 'string' ? req.body.Digits : '';
  const callSid = typeof req.body.CallSid === 'string' ? req.body.CallSid : '';
  const preliminary = canDialPbx({ to, digit, callSid, allowedDigits: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] });
  if (preliminary === 'invalid-number') return res.status(400).send('Invalid destination');
  if (preliminary === 'invalid-call') return res.status(400).send('Invalid CallSid');
  const menu = await activeMenu(to);
  const response = new twilio.twiml.VoiceResponse();
  if (!menu) {
    response.say(sayOptions, 'Sentralbordet er ikke tilgjengelig akkurat nå.');
    response.hangup();
    return sendXml(res, response);
  }
  const selection = canDialPbx({
    to, callSid, digit, allowedDigits: menu.departments.map(department => department.digit),
  });
  const department = menu.departments.find(d => d.digit === digit);
  if (selection !== 'dial' || !department) {
    response.say(sayOptions, 'Ugyldig valg, eller ingen tast ble registrert. Vennligst ring igjen.');
    response.hangup();
    return sendXml(res, response);
  }
  const client = await db.connect();
  let accepted = false;
  let limitExceeded = false;
  try {
    await client.query('BEGIN');
    // Serialize the cap check and insert for this destination, including concurrent callbacks.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [to]);
    const existing = await client.query(
      'SELECT call_sid FROM phone.pbx_call_selections WHERE call_sid=$1 LIMIT 1', [callSid],
    );
    if (existing.rowCount) {
      // Replay of a previously processed call. Do not initiate a second dial.
    } else {
      const count = await client.query(
        "SELECT count(*)::int AS total FROM phone.pbx_call_selections WHERE phone_number=$1 AND created_at >= date_trunc('day', now())",
        [to],
      );
      if (Number(count.rows[0]?.total ?? 0) >= MAX_PBX_SELECTIONS_PER_NUMBER_PER_DAY) {
        limitExceeded = true;
      } else {
        const inserted = await client.query(
          'INSERT INTO phone.pbx_call_selections(call_sid,user_id,phone_number,digit,department_label) ' +
          'VALUES($1,$2,$3,$4,$5) ON CONFLICT(call_sid) DO NOTHING RETURNING call_sid',
          [callSid, menu.userId, to, digit, department.label],
        );
        accepted = !!inserted.rowCount;
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  if (!accepted) {
    response.say(sayOptions, limitExceeded
      ? 'Sentralbordet har nådd grensen for anrop i dag. Vennligst prøv igjen senere.'
      : 'Dette tastevalget er allerede behandlet.');
    response.hangup();
    return sendXml(res, response);
  }
  response.say(sayOptions, 'Setter deg over til ' + department.label + '.');
  const dial = response.dial({
    answerOnBridge: true, timeout: MAX_PBX_RING_SECONDS,
    timeLimit: MAX_PBX_CALL_SECONDS,
  });
  dial.client(clientIdentity(menu.userId));
  sendXml(res, response);
}));
