# Supabase integration status

## Live project discovery

The connected Supabase organization contains an active project named `Vedoy` in `eu-north-1`. A read-only schema inspection found these existing communication tables:

- `vedoy_comm_numbers`
- `vedoy_comm_threads`
- `vedoy_comm_messages`
- `vedoy_comm_calls`
- `vedoy_comm_kyc_submissions`

Their current columns use `owner_id`, provider IDs, and relationships between local numbers, threads, and messages. The Node API in this repository currently uses a different starter schema (`phone_numbers`, `messages`, `call_events`, and `kyc_submissions`) and therefore is not compatible with the shared project's communication schema as-is.

## Safe next step

Before configuring the shared Supabase URL and service key in the phone API, implement an explicit repository adapter for the `vedoy_comm_*` schema. Include number ownership and provisioning state, thread upsert and message history, call event updates, and KYC document references. Verify its access policies and test against a development branch first.

The checked-in `202610010001_initial.sql` migration is for a dedicated Vedoy Phone database only. Do not apply it to the shared Vedoy database because it would create a parallel communications data model. No Supabase schema changes were made during this publication.

The current shared project also returned security advisor findings for other existing tables and functions. Those findings are outside this app's scope; review them in the Supabase dashboard before making unrelated database changes.
