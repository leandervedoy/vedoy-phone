# Vedoy Phone

Vedoy Phone is an Expo development-build app and Node/TypeScript communications service for Twilio Voice, two-way SMS, number purchasing, and regulatory onboarding.

## Project structure

- `mobile/` Expo + React Native + TypeScript app
- `server/` Express service, Twilio webhooks, Neon Postgres, Neon Auth validation, and private KYC uploads
- `server/migrations/` additive phone schema migrations
- `public/` product website
- `docs/country-capabilities.md` how to interpret the live country catalog
- `docs/open-source-review.md` comparison with Twilio's Voice React Native reference architecture

The phone service uses a separate `phone` schema and a `phone/` object prefix inside the existing Neon project. Developer tables and objects are left intact. The production branch already has Neon Auth and a private `uploads` bucket. KYC files are sent through the authenticated Node service and stored in that bucket; provider credentials stay on the server.

## Local setup

1. Use Node.js 20 LTS. Copy `server/.env.example` to `server/.env` and `mobile/.env.example` to `mobile/.env`.
2. In `server/.env`, set the Neon pooled `DATABASE_URL`, Neon Auth base URL, Neon Storage S3 credentials, Twilio credentials, and an administrator email for KYC review.
3. Apply `server/migrations/001_phone_schema.sql` to the Neon database.
4. In `server/`, run `npm install` and `npm run dev`.
5. In `mobile/.env`, set `EXPO_PUBLIC_API_URL` to the HTTPS origin of the Node service. Then run `npm install`, `npx expo prebuild`, and `npx expo run:ios` or `npx expo run:android`.

Expo Go is unsupported for Twilio Voice. Use an Expo development build. Incoming calls also require APNs VoIP and Firebase credentials configured with Twilio and EAS; test on physical devices.

## Authentication and documents

The app signs in through Neon Auth using Better Auth's Expo integration and secure device storage. The server validates each session against the Neon Auth endpoint before accepting account requests. User data is stored in Neon Postgres; private ID and address files are uploaded by the server to the Neon `uploads` bucket under `phone/{userId}/`.

The first-party database migration creates tables only inside the `phone` schema. No Supabase service, SDK, storage bucket, or credentials are used by the phone app or service. Existing Supabase records are not copied automatically; export and reconcile them separately before removing any old account or data.

## Telephony setup

Set a public HTTPS `PUBLIC_BASE_URL`, register `/webhooks/twilio/voice`, `/webhooks/twilio/voice/status`, and `/webhooks/twilio/sms/inbound` in Twilio, and configure the SMS status callback at `/webhooks/twilio/sms/status`. Preserve the externally visible request URL for Twilio signature validation.

Number search is scoped to the connected Twilio account. Customers can choose a country and number type, confirm a current monthly number price, and provision up to `MAX_NUMBERS_PER_USER` numbers. This charges the connected Twilio account. Customer checkout, subscriptions, and invoices are not implemented. Regulatory number types require administrator review and completed Twilio compliance mapping.

## Production checklist

- Configure database, Neon Auth, Neon Storage, Twilio credentials, push credentials, and administrator email in the Node service environment.
- Restrict API origins, terminate TLS, preserve webhook request details, and keep all provider credentials server-side.
- Set rate limits, abuse monitoring, verified destinations, spend alerts, retention/deletion policies, and a support path.
- Complete Twilio regulatory bundles and country-by-country legal review before selling each number type.
- Verify account access, document upload privacy, Twilio webhooks, and inbound/outbound calls on physical iOS and Android devices.

The source is a deployable foundation. It does not mean Twilio billing, customer checkout, regulatory approval, or the Node service has been configured or deployed.
