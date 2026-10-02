# Vedoy Phone

Vedoy Phone is an Expo development-build app and Node/TypeScript communications API for Twilio Programmable Voice, two-way SMS, phone-number purchasing, and regulatory onboarding. The public product and developer website lives in `public/` and is deployed separately from the communications API.

## Project structure

- `mobile/` Expo + React Native + TypeScript application
- `server/` Express API, Twilio webhooks and Supabase persistence
- `public/` Vedoy Phone product site and developer portal for Vercel
- `supabase/migrations/` production-oriented schema with row-level security
- `docs/country-capabilities.md` how to interpret the live country catalog
- `docs/open-source-review.md` comparison with the official Twilio Voice React Native reference architecture
- Mobile `Apper` tab with shortcuts to Autocalls AI, Wix, OpenAI Developers, ChatGPT, Supabase, Vercel and Twilio Console; the Computer feature is clearly marked desktop-only

The Vercel deployment serves the static website only. It does not run `server/`, vend Voice tokens, handle Twilio webhooks, or make number purchasing live. Deploy the API to a persistent Node service with a public HTTPS origin, configure its secrets there, and point the mobile build at that API.

## Start locally

1. Install Node.js 20 LTS and copy `server/.env.example` to `server/.env`.
2. Configure Twilio API credentials, a Voice Application SID, Supabase project URL and service key on the server only.
3. Apply `supabase/migrations/202610010001_initial.sql` only to a dedicated Vedoy Phone Supabase project. The existing shared Vedoy Supabase project already has `vedoy_comm_*` communication tables with a different schema; do not apply this starter migration there before implementing and reviewing a schema adapter. See `docs/supabase-integration.md`.
   If upgrading a dedicated database that already has `sms_opt_outs`, also apply `supabase/migrations/202610020001_sms_opt_out_per_line.sql`.
4. In `server/`, run `npm install`, `npm run dev`.
5. In `mobile/`, set `EXPO_PUBLIC_API_URL` to the HTTPS API origin, run `npm install`, then `npx expo prebuild` and `npx expo run:ios` or `npx expo run:android`.

Expo Go is unsupported for Twilio Voice. Use an Expo development build. For inbound calls, configure an APNs VoIP push credential and Firebase credentials with Twilio and EAS; the simulator cannot validate incoming iOS calls.

The app uses Expo SDK 57, which is supported by the Twilio Voice React Native SDK 1.8+ Expo plugin. The native minimums are iOS 16.4 and Android API 24. The shortcuts are external links only: Wix and ChatGPT include official iOS/Android store links; Autocalls, OpenAI Developers, Supabase, Vercel and Twilio Console open their web dashboards. The Computer feature needs supported desktop software and does not enable remote-control features on mobile. No partner accounts, API credentials or data are connected through these shortcuts.

## Account and live-service setup

Create Supabase Auth users and configure email/password or an OAuth provider. The mobile client uses the Supabase publishable/anon key only. The backend validates Supabase JWTs and uses its service role key for server-side persistence. Never put Twilio secrets or the Supabase service role key in the app.

Set a public HTTPS `PUBLIC_BASE_URL`, register `/webhooks/twilio/voice`, `/webhooks/twilio/voice/status`, and `/webhooks/twilio/sms/inbound` in Twilio, and ensure the exact externally visible URL is used for signature validation. Set the outbound messaging status callback to `/webhooks/twilio/sms/status`.

KYC documents are uploaded privately to Supabase Storage. In this starter, review status is administrator-controlled; the app does not claim automated Twilio Regulatory Bundle submission. Implement country-specific Twilio Regulatory Compliance APIs and an audited human approval queue before real production sales.

## Production launch checklist

- Configure Twilio push credentials and test calls on physical iOS and Android devices.
- Restrict API CORS to the app's approved origins; terminate TLS at the ingress and preserve the original host/protocol for webhook validation.
- Set rate limits, abuse monitoring, verified caller destinations, spend alerts, backups, retention/deletion policies, and a support escalation path.
- Complete Twilio regulatory bundles/number mapping and country legal review for every number type sold.
- Configure Supabase Storage private bucket policies and user access policies before accepting identity documents.
- Validate webhook signatures using the externally visible URL and raw form fields; never disable validation in production.

Phone provisioning charges the connected Twilio account. The mobile flow shows the current monthly Twilio number price and confirms it before provisioning, but end-customer billing, subscriptions and invoices are not implemented. Usage charges are separate. This source is a deployable foundation, not an assertion that Twilio credentials, country approvals, push credentials, customer billing, legal review, or a production deployment have already been configured.

## Current completion status

- Number search is account-scoped and live when a Twilio account is configured. The customer can select a country and number type, search, confirm a current monthly Twilio price, and provision up to `MAX_NUMBERS_PER_USER` numbers. Regulatory number types require an approved compliance record. This flow charges the connected Twilio account; it is not customer checkout.
- SMS conversations are separated by both the peer and the owned Vedoy line. Outbound SMS keeps the selected `From` number, including when a Messaging Service SID is configured. STOP records are scoped per line; legacy global records remain global after migration.
- KYC uploads are labelled as identity or address proof by the user's explicit choice, independent of file format. A human administrator still must verify and map Twilio compliance before restricted numbers can be purchased.
- Live operation requires real Supabase and Twilio credentials, a public HTTPS API, webhook setup, a native Expo development build, device push credentials, and regulatory approval. This workspace contains no proof that those external services are configured or deployed.
