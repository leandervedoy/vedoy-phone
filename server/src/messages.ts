import { Router } from 'express';
import { z } from 'zod';
import { db, twilioClient } from './clients.js';
import { env } from './config.js';
import { asyncRoute, destinationAllowed, e164, validateTwilio } from './http.js';

export const messages = Router();

messages.get('/threads', asyncRoute(async (req, res) => {
  const rows = await db`
    SELECT from_number, to_number, body, direction, date_created
    FROM phone.messages
    WHERE user_id = ${req.userId!}
    ORDER BY date_created DESC
    LIMIT 300
  `;
  const grouped = new Map<string, {
    phone: string;
    line: string;
    lastMessage: string;
    dateCreated: string;
  }>();
  for (const row of rows) {
    const phone = row.direction === 'outbound' ? row.to_number : row.from_number;
    const line = row.direction === 'outbound' ? row.from_number : row.to_number;
    const key = `${line}:${phone}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        phone,
        line,
        lastMessage: row.body,
        dateCreated: row.date_created,
      });
    }
  }
  res.json({ threads: [...grouped.values()] });
}));

messages.get('/threads/:phone', asyncRoute(async (req, res) => {
  const peer = String(req.params.phone ?? '');
  const line = String(req.query.line ?? '');
  if (!e164(peer) || !e164(line)) {
    return res.status(400).json({ message: 'Ugyldig nummer eller linje.' });
  }

  const [owned] = await db`
    SELECT id
    FROM phone.phone_numbers
    WHERE user_id = ${req.userId!} AND phone_number = ${line}
    LIMIT 1
  `;
  if (!owned) return res.status(403).json({ message: 'Linjen tilhører ikke kontoen.' });

  const conversation = await db`
    SELECT twilio_sid, from_number, to_number, body, direction, status, date_created
    FROM phone.messages
    WHERE user_id = ${req.userId!}
      AND (
        (from_number = ${peer} AND to_number = ${line} AND direction = 'inbound')
        OR (from_number = ${line} AND to_number = ${peer} AND direction = 'outbound')
      )
    ORDER BY date_created ASC
    LIMIT 200
  `;
  res.json({ messages: conversation });
}));

messages.post('/', asyncRoute(async (req, res) => {
  const parsed = z.object({
    to: z.string().refine(e164),
    body: z.string().trim().min(1).max(1500),
    from: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Kontroller mottakernummer og meldingstekst.' });

  const { to, body } = parsed.data;
  if (!destinationAllowed(to, env.SMS_ALLOWED_COUNTRIES)) {
    return res.status(403).json({ message: 'Mottakerlandet er ikke aktivert for SMS på denne tjenesten.' });
  }

  const sentRows = await db`
    SELECT count(*)::integer AS count
    FROM phone.messages
    WHERE user_id = ${req.userId!}
      AND direction = 'outbound'
      AND date_created >= now() - interval '1 minute'
  `;
  if ((sentRows[0]?.count ?? 0) >= env.MAX_SMS_PER_MINUTE) {
    return res.status(429).json({ message: 'Du har nådd grensen for meldinger per minutt.' });
  }

  const ownedRows = parsed.data.from
    ? await db`
      SELECT phone_number, capabilities
      FROM phone.phone_numbers
      WHERE user_id = ${req.userId!}
        AND status = 'active'
        AND capabilities->>'sms' = 'true'
        AND phone_number = ${parsed.data.from}
      LIMIT 1
    `
    : await db`
      SELECT phone_number, capabilities
      FROM phone.phone_numbers
      WHERE user_id = ${req.userId!}
        AND status = 'active'
        AND capabilities->>'sms' = 'true'
      ORDER BY created_at ASC
      LIMIT 1
    `;
  const owned = ownedRows[0];
  if (!owned) return res.status(403).json({ message: 'Velg en aktiv linje med SMS-støtte.' });

  const optOut = await db`
    SELECT recipient
    FROM phone.sms_opt_outs
    WHERE user_id = ${req.userId!}
      AND from_number IN (${owned.phone_number}, '*')
      AND recipient = ${to}
    LIMIT 1
  `;
  if (optOut.length) {
    return res.status(403).json({ message: 'Mottakeren har meldt seg av SMS fra denne linjen.' });
  }

  const created = await twilioClient.messages.create({
    to,
    body,
    from: owned.phone_number,
    ...(env.TWILIO_MESSAGING_SERVICE_SID ? { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID } : {}),
    statusCallback: `${env.PUBLIC_BASE_URL}/webhooks/twilio/sms/status`,
  });
  await db`
    INSERT INTO phone.messages
      (twilio_sid, user_id, from_number, to_number, body, direction, status, date_created)
    VALUES
      (${created.sid}, ${req.userId!}, ${owned.phone_number}, ${to}, ${body}, 'outbound', ${created.status}, now())
    ON CONFLICT (twilio_sid) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      from_number = EXCLUDED.from_number,
      to_number = EXCLUDED.to_number,
      body = EXCLUDED.body,
      direction = EXCLUDED.direction,
      status = EXCLUDED.status,
      date_created = EXCLUDED.date_created
  `;
  res.status(202).json({ sid: created.sid, status: created.status });
}));

export const twilioSms = Router();

twilioSms.post('/inbound', validateTwilio, asyncRoute(async (req, res) => {
  const from = String(req.body.From ?? '');
  const to = String(req.body.To ?? '');
  const sid = String(req.body.MessageSid ?? '');
  const body = String(req.body.Body ?? '');
  const [owned] = await db`
    SELECT user_id, capabilities
    FROM phone.phone_numbers
    WHERE phone_number = ${to} AND status = 'active'
    LIMIT 1
  `;
  if (!owned) return res.status(404).send('Unknown number');
  if (!owned.capabilities?.sms) return res.status(403).send('SMS unsupported');

  await db`
    INSERT INTO phone.messages
      (twilio_sid, user_id, from_number, to_number, body, direction, status, date_created)
    VALUES
      (${sid}, ${owned.user_id}, ${from}, ${to}, ${body}, 'inbound', 'received', now())
    ON CONFLICT (twilio_sid) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      from_number = EXCLUDED.from_number,
      to_number = EXCLUDED.to_number,
      body = EXCLUDED.body,
      direction = EXCLUDED.direction,
      status = EXCLUDED.status,
      date_created = EXCLUDED.date_created
  `;
  if (/^\s*(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)\s*$/i.test(body)) {
    await db`
      INSERT INTO phone.sms_opt_outs (user_id, from_number, recipient, source_message_sid)
      VALUES (${owned.user_id}, ${to}, ${from}, ${sid})
      ON CONFLICT (user_id, from_number, recipient)
      DO UPDATE SET source_message_sid = EXCLUDED.source_message_sid
    `;
  }
  res.type('text/xml').send('<Response/>');
}));

twilioSms.post('/status', validateTwilio, asyncRoute(async (req, res) => {
  const sid = String(req.body.MessageSid ?? '');
  if (sid) {
    await db`
      UPDATE phone.messages
      SET status = ${String(req.body.MessageStatus ?? 'unknown')},
          error_code = ${req.body.ErrorCode ? String(req.body.ErrorCode) : null}
      WHERE twilio_sid = ${sid}
    `;
  }
  res.sendStatus(204);
}));
