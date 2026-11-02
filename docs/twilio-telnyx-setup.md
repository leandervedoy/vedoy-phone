# Vedoy Phone: Twilio og Telnyx - oppstart

## Twilio (5 steg)
1. Opprett bedriftskonto pa https://www.twilio.com/try-twilio og bekreft e-post og mobil.
2. Legg inn betalingsmetode og fullfor identitetskontroll om du blir bedt om det.
3. Finn Account SID og Auth Token i Console. Lag separat API Key SID og Secret under API Keys. Lagre kun server-side.
4. Skaff et tale-kompatibelt nummer og sjekk hva som faktisk stottes for Norge (SMS, nummerkrav, innkommende samtaler).
5. Sett webhooks mot PUBLIC_BASE_URL/webhooks/twilio/voice og /webhooks/twilio/sms/inbound. Konfigurer TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID og TWILIO_CALLER_ID.

## Telnyx (5 steg)
1. Opprett konto pa https://telnyx.com/sign-up og bekreft organisasjon.
2. Logg inn pa https://portal.telnyx.com, legg inn betaling og fullfor eventuell KYC.
3. Opprett API v2-nokkel og lagre kun som TELNYX_API_KEY pa server.
4. Opprett Voice API application / connection og outbound voice profile. Finn TELNYX_CONNECTION_ID.
5. Kontroller norske nummerkrav og SMS-muligheter. Sett opp signerte HTTPS-webhooks og test med testnummer for salg. Ikke legg API-nokler i frontend.

## Sentralbord
- Kjor server/migrations/002_pbx.sql i eksisterende Neon-database (med phone-schema).
- Responsivt administrasjonspanel: /pbx.html, API: /v1/pbx/dashboard, /v1/pbx/settings og /v1/pbx/extensions.
- API krever eksisterende Neon Auth-sesjon. Tilgang til tabellene er begrenset med user_id i serversporringene.
- Dette er et kontrollpanel for konfigurasjon. **Ekte samtalekoe, IVR, ruting og Telnyx-webhook er ikke koblet til ennå.**
- Integrer klientinnlogging og serve statisk /pbx.html via riktig host for denne delen av prosjektet.
- Test migrasjon, innlogging, API-validering, webhooks og oppkall pa ekte enheter for produksjon.
