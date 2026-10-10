import { Router } from 'express';
import { z } from 'zod';
import countryData from 'i18n-iso-countries';
import english from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import { db, twilioClient } from './clients.js';
import { env } from './config.js';
import { asyncRoute, e164 } from './http.js';
import { phoneNumberPrices } from './pricing.js';

export const numbers = Router();
countryData.registerLocale(english);

const types = ['local', 'mobile', 'tollFree'] as const;
type NumberType = (typeof types)[number];
type SearchResult = {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  addressRequirements: string;
};

async function listNumbers(
  country: string,
  type: NumberType,
  opts: { limit?: number; contains?: string },
): Promise<SearchResult[]> {
  const resource = twilioClient.availablePhoneNumbers(country);
  const items = type === 'local'
    ? await resource.local.list(opts)
    : type === 'mobile'
      ? await resource.mobile.list(opts)
      : await resource.tollFree.list(opts);
  return items.map(number => ({
    phoneNumber: number.phoneNumber,
    friendlyName: number.friendlyName,
    locality: number.locality,
    capabilities: number.capabilities,
    addressRequirements: number.addressRequirements,
  }));
}

numbers.get('/mine', asyncRoute(async (req, res) => {
  const owned = await db`
    SELECT id, phone_number, country_code, number_type, capabilities, status, created_at
    FROM phone.phone_numbers
    WHERE user_id = ${req.userId!}
      AND status IN ('active', 'pending')
    ORDER BY created_at ASC
  `;
  res.json({ numbers: owned });
}));

numbers.delete('/mine/:id', asyncRoute(async (req, res) => {
  const id = String(req.params.id ?? '');
  const [line] = await db`
    SELECT id, twilio_sid
    FROM phone.phone_numbers
    WHERE id = ${id}::uuid
      AND user_id = ${req.userId!}
      AND status = 'active'
    LIMIT 1
  `;
  if (!line) return res.status(404).json({ message: 'Fant ikke en aktiv linje på kontoen.' });
  if (!line.twilio_sid) return res.status(409).json({ message: 'Linjen mangler Twilio-referanse.' });

  await twilioClient.incomingPhoneNumbers(line.twilio_sid).remove();
  const updated = await db`
    UPDATE phone.phone_numbers
    SET status = 'released', updated_at = now()
    WHERE id = ${id}::uuid AND user_id = ${req.userId!}
    RETURNING id
  `;
  if (!updated.length) throw new Error('Phone number disappeared before it could be released.');
  return res.sendStatus(204);
}));

numbers.get('/countries', asyncRoute(async (_req, res) => {
  const list = await twilioClient.availablePhoneNumbers.list({ limit: 1000 });
  const byCode = new Map(list.map(country => [country.countryCode, country]));
  const voicePolicy = new Set(env.VOICE_ALLOWED_COUNTRIES.split(',').map(x => x.trim().toUpperCase()).filter(Boolean));
  const smsPolicy = new Set(env.SMS_ALLOWED_COUNTRIES.split(',').map(x => x.trim().toUpperCase()).filter(Boolean));
  const countries = Object.keys(countryData.getAlpha2Codes()).map(countryCode => {
    const twilioCountry = byCode.get(countryCode);
    return {
      countryCode,
      country: twilioCountry?.country ?? countryData.getName(countryCode, 'en') ?? countryCode,
      numberTypes: Object.keys(twilioCountry?.subresourceUris ?? {}).filter(key => types.includes(key as NumberType)),
      numberSearchAvailable: !!twilioCountry,
      outboundVoicePolicyEnabled: voicePolicy.has(countryCode),
      outboundSmsPolicyEnabled: smsPolicy.has(countryCode),
      mobileData: false,
      providerGeoPermissionMustAlsoBeEnabled: true,
      regulatoryRequirements: 'Check against each number type before purchase',
    };
  }).sort((a, b) => a.country.localeCompare(b.country));
  res.json({
    countries,
    source: 'ISO country list + live account-scoped Twilio number catalog',
    outboundPolicy: 'Vedoy allowlist; Twilio geo permissions and destination rates are separate',
  });
}));

numbers.get('/countries/:code/capabilities', asyncRoute(async (req, res) => {
  const country = String(req.params.code ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return res.status(400).json({ message: 'Ugyldig landkode.' });
  const parent = await twilioClient.availablePhoneNumbers(country).fetch();
  const rows = await Promise.all(
    Object.keys(parent.subresourceUris ?? {})
      .filter(key => types.includes(key as NumberType))
      .map(async type => {
        const [number] = await listNumbers(country, type as NumberType, { limit: 1 });
        return {
          type,
          available: !!number,
          exampleCapabilities: number?.capabilities ?? null,
          addressRequirements: number?.addressRequirements ?? null,
        };
      }),
  );
  res.json({
    countryCode: country,
    country: parent.country,
    numberTypes: rows,
    internationalVoice: 'Check the Twilio destination route and account geo-permissions separately.',
    internationalSms: 'Check sender-country and destination delivery requirements separately.',
    mobileData: false,
    note: 'Example capabilities are a live sample only. Always use the selected number’s own capability and regulatory metadata.',
  });
}));

numbers.get('/countries/:code/pricing', asyncRoute(async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return res.status(400).json({ message: 'Ugyldig landkode.' });
  res.json({
    countryCode: code,
    prices: await phoneNumberPrices(code),
    billing: 'Monthly Twilio recurring number charge; usage billed separately.',
  });
}));

numbers.get('/available', asyncRoute(async (req, res) => {
  const parsed = z.object({
    country: z.string().length(2).transform(value => value.toUpperCase()),
    type: z.enum(types).default('local'),
    contains: z.string().max(16).optional(),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Velg en gyldig landkode og nummertype.' });

  const { country, type, contains } = parsed.data;
  const [available, priceResult] = await Promise.all([
    listNumbers(country, type, { limit: env.MAX_NUMBER_SEARCH_RESULTS, ...(contains ? { contains } : {}) }),
    phoneNumberPrices(country).catch(() => ({} as Record<string, import('./pricing.js').Price>)),
  ]);
  const prices: Record<string, import('./pricing.js').Price> = priceResult;
  res.json({
    numbers: available.map(number => ({
      ...number,
      numberType: type,
      countryCode: country,
      monthlyPrice: prices[type]?.monthlyPrice ?? null,
      currency: prices[type]?.currency ?? null,
    })),
    mobileData: false,
  });
}));

numbers.post('/purchase', asyncRoute(async (req, res) => {
  const input = z.object({
    phoneNumber: z.string().refine(e164),
    countryCode: z.string().length(2).transform(value => value.toUpperCase()),
    numberType: z.enum(types),
    confirmedMonthlyPrice: z.string().min(1),
    currency: z.string().length(3),
  }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: 'Bekreft månedlig pris før kjøp.' });

  const user = req.userId!;
  const latestPrices = await phoneNumberPrices(input.data.countryCode).catch(() => null);
  const current = latestPrices?.[input.data.numberType];
  if (!current) return res.status(503).json({ message: 'Fant ikke en oppdatert pris. Prøv igjen senere.' });
  if (
    current.monthlyPrice !== input.data.confirmedMonthlyPrice
    || current.currency !== input.data.currency.toUpperCase()
  ) {
    return res.status(409).json({
      message: 'Månedsprisen er endret. Kontroller prisen før du prøver på nytt.',
      current,
    });
  }

  const available = await listNumbers(input.data.countryCode, input.data.numberType, {
    contains: input.data.phoneNumber,
    limit: 100,
  });
  const number = available.find(item => item.phoneNumber === input.data.phoneNumber);
  if (!number) return res.status(409).json({ message: 'Nummeret er ikke lenger tilgjengelig.' });

  let regulatoryAddressSid: string | undefined;
  if (number.addressRequirements !== 'none') {
    const [kyc] = await db`
      SELECT id, status, twilio_address_sid, twilio_compliance_complete
      FROM phone.kyc_submissions
      WHERE user_id = ${user} AND status = 'approved'
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (!kyc || !kyc.twilio_compliance_complete) {
      return res.status(403).json({
        message: 'Dette nummeret krever godkjent dokumentasjon og gjennomført Twilio-compliance før aktivering.',
      });
    }
    if (!kyc.twilio_address_sid) {
      return res.status(503).json({ message: 'KYC-godkjenningen mangler en Twilio-adresse.' });
    }
    regulatoryAddressSid = kyc.twilio_address_sid;
  }

  let reservationId: string;
  try {
    const [reservation] = await db`
      SELECT phone.reserve_phone_number(
        ${user},
        ${input.data.phoneNumber},
        ${input.data.countryCode},
        ${input.data.numberType},
        ${JSON.stringify(number.capabilities)}::jsonb,
        ${env.MAX_NUMBERS_PER_USER}
      ) AS id
    `;
    if (!reservation) throw new Error('Phone number reservation returned no row.');
    reservationId = reservation.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    if (message.includes('number_limit')) {
      return res.status(409).json({ message: `Kontogrensen er ${env.MAX_NUMBERS_PER_USER} aktive numre.` });
    }
    if (code === '23505') {
      return res.status(409).json({ message: 'Nummeret er allerede knyttet til en konto.' });
    }
    throw error;
  }

  let provisionedSid: string | undefined;
  try {
    const provisioned = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: input.data.phoneNumber,
      voiceUrl: `${env.PUBLIC_BASE_URL}/webhooks/twilio/voice`,
      voiceMethod: 'POST',
      smsUrl: `${env.PUBLIC_BASE_URL}/webhooks/twilio/sms/inbound`,
      smsMethod: 'POST',
      statusCallback: `${env.PUBLIC_BASE_URL}/webhooks/twilio/voice/status`,
      statusCallbackMethod: 'POST',
      ...(regulatoryAddressSid ? { addressSid: regulatoryAddressSid } : {}),
    });
    provisionedSid = provisioned.sid;
    const updated = await db`
      UPDATE phone.phone_numbers
      SET twilio_sid = ${provisioned.sid}, status = 'active', updated_at = now()
      WHERE id = ${reservationId}::uuid AND user_id = ${user}
      RETURNING id
    `;
    if (!updated.length) throw new Error('Phone number reservation disappeared before activation.');
    res.status(201).json({
      id: reservationId,
      phoneNumber: provisioned.phoneNumber,
      status: 'active',
      capabilities: provisioned.capabilities,
    });
  } catch (error) {
    if (provisionedSid) {
      try {
        await twilioClient.incomingPhoneNumbers(provisionedSid).remove();
      } catch (cleanupError) {
        console.error('number_cleanup_failed', {
          reservationId,
          provisionedSid,
          error: cleanupError,
        });
        await db`
          UPDATE phone.phone_numbers
          SET twilio_sid = ${provisionedSid}, status = 'pending', updated_at = now()
          WHERE id = ${reservationId}::uuid
        `;
        throw error;
      }
    }
    await db`
      UPDATE phone.phone_numbers
      SET status = 'failed', updated_at = now()
      WHERE id = ${reservationId}::uuid
    `;
    throw error;
  }
}));
