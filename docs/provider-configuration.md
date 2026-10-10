# Vedoy Phone provider configuration

The product website has no provider credentials. Configure the following values only in the deployed Node API environment (`server/.env` for local work, Vercel environment variables for the API deployment).

## Neon

- `DATABASE_URL`: pooled Postgres connection string for the existing Neon branch, with `sslmode=require`.
- `NEON_AUTH_BASE_URL`: the Neon Auth base URL used by the mobile session validator.
- `NEON_STORAGE_ENDPOINT`, `NEON_STORAGE_REGION`, `NEON_STORAGE_BUCKET`, `NEON_STORAGE_ACCESS_KEY_ID`, and `NEON_STORAGE_SECRET_ACCESS_KEY`: Neon Object Storage connection details and server-only credentials for the private KYC bucket.

For a fresh database, apply `server/migrations/001_phone_schema.sql` and then `neon/migrations/202610030001_phone_api_support.sql`. The existing Neon phone schema needs only the additive migration after review and testing on a temporary branch. Do not apply it to production without explicit approval. The phone app uses the dedicated `phone` schema, so it does not mix phone data with the developer portal tables.

## Twilio

Twilio is the provider currently implemented by the API. Set the account, API key, API secret, Auth Token, TwiML App SID, and caller ID shown in `server/.env.example`.

Register these HTTPS webhook URLs in Twilio after the API is deployed:

- `POST /webhooks/twilio/voice`
- `POST /webhooks/twilio/voice/status`
- `POST /webhooks/twilio/sms/inbound`
- `POST /webhooks/twilio/sms/status`

The public API URL must remain the same URL Twilio calls because the server validates its webhook signature.

## Telnyx

Telnyx configuration is prepared in `server/.env.example` for a future provider adapter. Store the V2 API key, account public key, Messaging Profile ID, voice Connection ID, and caller ID only in the API environment.

When the adapter is implemented, configure Telnyx webhooks on the Messaging Profile and voice Connection, then verify each request with the `telnyx-signature-ed25519` and `telnyx-timestamp` headers using the account public key. Do not treat Telnyx as enabled until the adapter and verified webhook routes are deployed.
