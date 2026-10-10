# Vedoy Phone

Vedoy Phone is an Expo development-build app and Node/TypeScript communications API for Twilio Programmable Voice, two-way SMS, phone-number purchasing, and regulatory onboarding. The public product and developer website lives in `public/` and is deployed separately from the communications API.

## Project structure

- `mobile/` Expo + React Native + TypeScript application
- `server/` Express API, Twilio webhooks, Neon Postgres, and private Neon Object Storage
- `public/` Vedoy Phone product site and developer portal for Vercel
- `neon/migrations/` schema changes for the existing Neon `phone` schema
- `docs/neon-integration.md` Neon Auth, database, and storage configuration
- `docs/country-capabilities.md` how to interpret the live country catalog
- `docs/open-source-review.md` comparison with the official Twilio Voice React Native reference architecture

The mobile `Apper` tab includes shortcuts to Autocalls AI, Wix, OpenAI Developers, ChatGPT, Neon, Vercel, and Twilio Console. The Computer feature is clearly marked desktop-only.

The Vercel deployment serves the static website only. It does not run `server/`, vend Voice tokens, handle Twilio webhooks, or make number purchasing live. Deploy the API to a persistent Node service with a public HTTPS origin, configure its secrets there, and point the mobile build at that API.

## Start locally

1. Install Node.js 20 LTS. Copy `server/.env.example` to `server/.env` and `mobile/.env.example` to the Expo environment.
2. Set `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and the server-only Neon Object Storage credentials from the selected Neon project. Configure the Twilio API credentials and Voice Application SID on the server only.
3. Review `neon/migrations/202610030001_phone_api_support.sql` and apply it to a temporary Neon branch first. Do not apply it to the protected production branch without explicit approval.
4. In `server/`, run `npm install` and `npm run dev`.
5. In `mobile/`, set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_NEON_AUTH_URL`, run `npm install`, then `npx expo prebuild` and `npx expo run:ios` or `npx expo run:android`.

Expo Go is unsupported for Twilio Voice. Use an Expo development build. For inbound calls, configure an APNs VoIP push credential and Firebase credentials with Twilio and EAS; the simulator cannot validate incoming iOS calls.

The app uses Expo SDK 57, supported by the Twilio Voice React Native SDK 1.8+ Expo plugin. Native minimums are iOS 16.4 and Android API 24. External app shortcuts do not link accounts or share credentials.

## Account and live-service setup

Enable email/password and email verification by code in Neon Managed Better Auth. Add the app scheme `vedoyconnect://` to Neon Auth's trusted origins, and configure production email delivery. The app stores its Better Auth session in Expo SecureStore and obtains short-lived Neon JWTs for API requests. The API validates JWT signatures through Neon Auth JWKS and looks up the user in `neon_auth`.

The server connects directly to Neon Postgres through `DATABASE_URL`. KYC documents are sent through the authenticated API to the private Neon Object Storage bucket; storage credentials never belong in the mobile app. Uploads are limited to 10 MB and JPEG, PNG, WebP, or PDF.

Set a public HTTPS `PUBLIC_BASE_URL`, register `/webhooks/twilio/voice`, `/webhooks/twilio/voice/status`, and `/webhooks/twilio/sms/inbound` in Twilio, and ensure the exact externally visible URL is used for signature validation. Set the outbound messaging status callback to `/webhooks/twilio/sms/status`.

In this starter, KYC review status is administrator-controlled; the app does not claim automated Twilio Regulatory Bundle submission. Implement country-specific Twilio Regulatory Compliance APIs and an audited human approval queue before real production sales.

## Production launch checklist

- Configure Twilio push credentials and test calls on physical iOS and Android devices.
- Restrict API CORS to approved origins; terminate TLS at the ingress and preserve the original host/protocol for webhook validation.
- Set rate limits, abuse monitoring, verified caller destinations, spend alerts, backups, retention/deletion policies, and a support escalation path.
- Complete Twilio regulatory bundles/number mapping and country legal review for every number type sold.
- Keep Neon database and Object Storage credentials on the server; keep the KYC bucket private.
- Validate webhook signatures using the externally visible URL and raw form fields; never disable validation in production.

Phone provisioning charges the connected Twilio account. The mobile flow shows the current monthly Twilio number price and confirms it before provisioning, but end-customer billing, subscriptions, and invoices are not implemented. Usage charges are separate. This source is a deployable foundation, not an assertion that external services, customer billing, legal review, or a production deployment have been configured.
