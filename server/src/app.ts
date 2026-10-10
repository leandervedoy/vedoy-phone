import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env, missingLiveConfig } from './config.js';
import { requireAuth } from './auth.js';
import { numbers } from './numbers.js';
import { messages, twilioSms } from './messages.js';
import { voice, twilioVoice } from './voice.js';
import { kyc } from './kyc.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((helmet as unknown as () => express.RequestHandler)());
app.use((req, _res, next) => {
  if (req.url === '/api') req.url = '/';
  else if (req.url.startsWith('/api/')) req.url = req.url.slice(4);
  next();
});
const origins = env.APP_ORIGINS.split(',').map(value => value.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || origins.includes(origin)) return callback(null, true);
  callback(new Error('Origin not allowed'));
}, credentials: true }));
app.use('/webhooks/twilio', express.urlencoded({ extended: false, limit: '64kb' }));
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.status(missingLiveConfig.length ? 503 : 200).json({ ok: missingLiveConfig.length === 0, service: 'vedoy-phone-api', missingConfiguration: missingLiveConfig }));
app.use((req, res, next) => {
  if (!missingLiveConfig.length) return next();
  res.status(503).json({ message: 'Telefonitjenesten er ikke konfigurert ennå.', missingConfiguration: missingLiveConfig });
});
const apiLimit = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
app.use('/v1', apiLimit, requireAuth);
app.use('/v1/numbers', numbers);
app.use('/v1/messages', messages);
app.use('/v1/voice', voice);
app.use('/v1/kyc', kyc);
app.use('/webhooks/twilio/voice', twilioVoice);
app.use('/webhooks/twilio/sms', twilioSms);
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('request_failed', err instanceof Error ? { name: err.name, message: env.NODE_ENV === 'production' ? 'redacted' : err.message } : err);
  const status = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
    ? err.status
    : 500;
  if (status === 413) return res.status(413).json({ message: 'Filen er større enn grensen på 10 MB.' });
  res.status(status >= 400 && status < 600 ? status : 500).json({
    message: status >= 400 && status < 500
      ? 'Forespørselen kunne ikke behandles.'
      : 'Noe gikk galt. Prøv igjen eller kontakt støtte.',
  });
});
