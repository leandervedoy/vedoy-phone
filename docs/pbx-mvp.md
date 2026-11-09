# Vedoy PBX - Twilio reference-based MVP

This feature extends Vedoy Phone's Twilio Voice React Native SDK integration using official Twilio examples:
- [Twilio Voice React Native reference app](https://github.com/twilio/twilio-voice-react-native-app) for VoIP registration/calling and token vending
- [Twilio Node/Express IVR tutorial](https://www.twilio.com/docs/voice/tutorials/build-interactive-voice-response-ivr-phone-tree/node) for DTMF <Gather>, <Say>, and <Dial>

Vedoy's implementation is original code, not a copied/forked full reference application.

## First release

- Signed-in number owner can configure one IVR per account (default OFF).
- Three suggested digits: 1 - Vedoy Studio, 2 - Vedoy Collective, 3 - Vedoy Assist.
- Editable Norwegian greeting and department names.
- Twilio-signed inbound calls to an enabled PBX number play the menu.
- Valid selection routes to the owner's existing Twilio Voice mobile SDK identity.
- Invalid or missing selection ends the call politely; no unbounded retry loop.
- Department choice is logged against CallSid; attempts are idempotent.
- If disabled or not configured, existing Vedoy Phone inbound routing is preserved.
- Existing outbound calls and SMS handling remain unchanged.

## Deployment order

1. Review and merge only after CI/build and product-owner approval.
2. Apply server/migrations/002_pbx_mvp.sql to the same Neon database as 001.
3. Configure Twilio credentials and PUBLIC_BASE_URL; never commit secrets.
4. Confirm an active, Voice-capable Twilio number is represented in phone.phone_numbers with the correct authenticated user_id.
5. Verify Twilio incoming Voice webhook is POST /webhooks/twilio/voice (and that the published base URL matches signature validation).
6. Configure mobile VoIP push credentials (Android Firebase and iOS APNs VoIP), install a native Expo dev build and sign in.
7. Open Vedoy Phone > Vedoy PBX, choose an owned line, save while disabled, then enable deliberately.
8. Call the line from another phone; test digits 1/2/3, invalid/no digit, app offline, and non-Voice number.
9. Check Twilio request inspector, call cost, and database phone.pbx_call_selections.

## Not yet included

This MVP is a first-party, single-account PBX pilot, **not** a multi-tenant white-label resale platform. It does not provision numbers, charge customers, route to individual employees, offer queues, call recording, AI answering, or number resale. No production number or Twilio console setting is changed by this PR.

Before commercialization: implement organization membership/roles and tenant isolation; seat/agent routing and availability; hosted queue/voicemail; audit logs, rate limits and anti-fraud controls; billing and cost caps; data retention and explicit recording consent; relevant Norwegian/Nkom number and resale compliance.
