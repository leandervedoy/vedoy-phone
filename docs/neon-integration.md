# Neon integration

Vedoy Phone targets the existing Neon project **Vedoy Developer Hub**. The API uses Neon Postgres for the `phone` data schema, Neon Managed Better Auth for mobile identity, and private Neon Object Storage for KYC documents. The project was inspected read-only while preparing this change; no production schema, Auth settings, or storage configuration were changed.

## Authentication

- Set `NEON_AUTH_BASE_URL` in the API environment and `EXPO_PUBLIC_NEON_AUTH_URL` in the Expo environment to the Managed Better Auth base URL.
- Enable email/password sign-in and email verification by one-time code in the Neon Auth settings. The mobile app sends and verifies the email OTP before signing in.
- Add `vedoyconnect://` to trusted origins for the native app. Configure a dedicated SMTP provider before production email verification.
- The mobile client stores the Better Auth session in Expo SecureStore, requests short-lived JWTs, and sends them to the API as bearer tokens. The API verifies EdDSA signatures against `/.well-known/jwks.json` and checks the subject against `neon_auth."user"`.

## Database

The selected database already contains the `phone` schema and its number, message, call-event, opt-out, and KYC tables. The checked-in migration `neon/migrations/202610030001_phone_api_support.sql` changes `phone.phone_numbers.country_code` to `varchar(2)` and adds the atomic per-user number reservation function expected by the API.

The migration has **not** been applied. Review it and test it on a temporary Neon branch before requesting approval to apply it to the protected production branch. The API expects KYC timestamps in the existing `created_at` and `updated_at` columns.

The API uses `DATABASE_URL` only on the server. Use a least-privilege database role where possible; do not put its connection string in the mobile build.

## Object Storage

The selected branch has a private `uploads` bucket. Configure the API with its S3-compatible endpoint, region, bucket name, and scoped server-only access key pair using `NEON_STORAGE_ENDPOINT`, `NEON_STORAGE_REGION`, `NEON_STORAGE_BUCKET`, `NEON_STORAGE_ACCESS_KEY_ID`, and `NEON_STORAGE_SECRET_ACCESS_KEY`.

The authenticated API accepts document bytes at `POST /v1/kyc/documents`, enforces a 10 MB maximum, allows JPEG/PNG/WebP/PDF content, and writes keys under `kyc/<user-id>/`. It checks object ownership before linking uploaded keys to a KYC submission. Storage credentials must never be exposed to the mobile app.

## Live operation

The server also requires Twilio credentials, a public HTTPS `PUBLIC_BASE_URL`, valid webhook signature configuration, and device push credentials for incoming calls. See the environment examples and the production checklist in the repository README. No credentials are checked in.
