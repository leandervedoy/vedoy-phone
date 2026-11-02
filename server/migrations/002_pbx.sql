CREATE SCHEMA IF NOT EXISTS phone;
CREATE TABLE IF NOT EXISTS phone.pbx_settings (
 user_id text PRIMARY KEY,
 business_name text NOT NULL DEFAULT 'Min bedrift',
 provider text NOT NULL DEFAULT 'twilio' CHECK(provider IN ('twilio','telnyx')),
 welcome_message text NOT NULL DEFAULT 'Velkommen. Vennligst vent.',
 open_from text NOT NULL DEFAULT '08:00',
 open_to text NOT NULL DEFAULT '16:00',
 closed_message text NOT NULL DEFAULT 'Vi har stengt akkurat nå.',
 fallback_number text,
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS phone.pbx_extensions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id text NOT NULL,
 name text NOT NULL,
 extension text NOT NULL,
 destination text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 UNIQUE(user_id,extension)
);
CREATE INDEX IF NOT EXISTS pbx_extensions_tenant ON phone.pbx_extensions(user_id);
REVOKE ALL ON phone.pbx_settings,phone.pbx_extensions FROM PUBLIC;
