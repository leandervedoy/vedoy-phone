import { Router } from 'express';
import twilio from 'twilio';
import { db, twilioClient } from './clients.js';
import { env } from './config.js';
import { asyncRoute, destinationAllowed, e164, validateTwilio } from './http.js';

const { AccessToken } = twilio.jwt;
export const voice = Router();

voice.post('/token', asyncRoute(async (req, res) => {
  const platform = req.body?.platform === 'ios'
    ? 'ios'
    : req.body?.platform === 'android'
      ? 'android'
      : null;
  if (!platform) return res.status(400).json({ message: 'Enhetsplattform mangler.' });

  const identity = `v_${req.userId!.replace(/-/g, '')}`;
  const token = new AccessToken(env.TWILIO_ACCOUNT_SID, env.TWILIO_API_KEY, env.TWILIO_API_SECRET, {
    identity,
    ttl: 3600,
  });
  const pushCredentialSid = platform === 'ios'
    ? env.TWILIO_IOS_PUSH_CREDENTIAL_SID
    : env.TWILIO_ANDROID_PUSH_CREDENTIAL_SID;
  token.addGrant(new AccessToken.VoiceGrant({
    outgoingApplicationSid: env.TWILIO_TWIML_APP_SID,
    incomingAllow: !!pushCredentialSid,
    ...(pushCredentialSid ? { pushCredentialSid } : {}),
  }));
  res.json({
    token: token.toJwt(),
    identity,
    expiresIn: 3600,
    incomingConfigured: !!pushCredentialSid,
  });
}));

voice.get('/history', asyncRoute(async (req, res) => {
  const calls = await db`
    SELECT call_sid, status, direction, from_number, to_number, duration_seconds, updated_at
    FROM phone.call_events
    WHERE user_id = ${req.userId!}
    ORDER BY updated_at DESC
    LIMIT 100
  `;
  res.json({ calls });
}));

export const twilioVoice = Router();

twilioVoice.post('/', validateTwilio, asyncRoute(async (req, res) => {
  const from = String(req.body.From ?? '');
  const to = String(req.body.To ?? '');
  const callerId = String(req.body.CallerId ?? '');
  const twiml = new twilio.twiml.VoiceResponse();

  if (from.startsWith('client:')) {
    const userId = await userForIdentity(from.slice(7));
    if (!userId) return res.status(403).send('Unknown client');
    if (!e164(to)) return res.status(400).send('Invalid destination');
    if (!destinationAllowed(to, env.VOICE_ALLOWED_COUNTRIES)) {
      return res.status(403).send('Destination country is not enabled for this service');
    }

    const ownedRows = callerId
      ? await db`
        SELECT phone_number, capabilities
        FROM phone.phone_numbers
        WHERE user_id = ${userId}
          AND status = 'active'
          AND capabilities->>'voice' = 'true'
          AND phone_number = ${callerId}
        ORDER BY created_at
        LIMIT 1
      `
      : await db`
        SELECT phone_number, capabilities
        FROM phone.phone_numbers
        WHERE user_id = ${userId}
          AND status = 'active'
          AND capabilities->>'voice' = 'true'
        ORDER BY created_at
        LIMIT 1
      `;
    const owned = ownedRows[0];
    if (!owned) return res.status(403).send('No active voice-capable number');

    const dial = twiml.dial({
      callerId: owned.phone_number,
      answerOnBridge: true,
      action: `${env.PUBLIC_BASE_URL}/webhooks/twilio/voice/status`,
      method: 'POST',
    });
    dial.number({
      statusCallback: `${env.PUBLIC_BASE_URL}/webhooks/twilio/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    }, to);
  } else {
    const [owned] = await db`
      SELECT user_id, capabilities
      FROM phone.phone_numbers
      WHERE phone_number = ${to} AND status = 'active'
      LIMIT 1
    `;
    if (!owned) return res.status(404).send('Number is not active');
    if (!owned.capabilities?.voice) return res.status(403).send('Voice unsupported');

    const identity = `v_${owned.user_id.replace(/-/g, '')}`;
    twiml.dial({
      action: `${env.PUBLIC_BASE_URL}/webhooks/twilio/voice/status`,
      method: 'POST',
    }).client(identity);
  }
  res.type('text/xml').send(twiml.toString());
}));

twilioVoice.post('/status', validateTwilio, asyncRoute(async (req, res) => {
  const callSid = String(req.body.CallSid ?? req.body.ParentCallSid ?? '');
  const status = String(req.body.CallStatus ?? req.body.DialCallStatus ?? '');
  const from = String(req.body.From ?? '');
  const to = String(req.body.To ?? '');
  let userId = from.startsWith('client:') ? await userForIdentity(from.slice(7)) : null;

  if (!userId) {
    const [owner] = await db`
      SELECT user_id
      FROM phone.phone_numbers
      WHERE phone_number = ${from} AND status = 'active'
      LIMIT 1
    `;
    userId = owner?.user_id ?? null;
  }
  if (!userId) {
    const [owner] = await db`
      SELECT user_id
      FROM phone.phone_numbers
      WHERE phone_number = ${to} AND status = 'active'
      LIMIT 1
    `;
    userId = owner?.user_id ?? null;
  }

  if (callSid && userId) {
    await db`
      INSERT INTO phone.call_events
        (call_sid, user_id, status, direction, from_number, to_number, duration_seconds, updated_at)
      VALUES
        (
          ${callSid},
          ${userId},
          ${status},
          ${String(req.body.Direction ?? '')},
          ${from},
          ${to},
          ${Number(req.body.CallDuration ?? req.body.DialCallDuration) || null},
          now()
        )
      ON CONFLICT (call_sid) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        status = EXCLUDED.status,
        direction = EXCLUDED.direction,
        from_number = EXCLUDED.from_number,
        to_number = EXCLUDED.to_number,
        duration_seconds = EXCLUDED.duration_seconds,
        updated_at = EXCLUDED.updated_at
    `;
  }
  res.sendStatus(204);
}));

async function userForIdentity(identity: string): Promise<string | null> {
  const match = /^v_([0-9a-f]{32})$/i.exec(identity);
  if (!match) return null;
  const hex = match[1]!.toLowerCase();
  const userId = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
  const [owner] = await db`
    SELECT user_id
    FROM phone.phone_numbers
    WHERE user_id = ${userId} AND status = 'active'
    LIMIT 1
  `;
  return owner?.user_id ?? null;
}
