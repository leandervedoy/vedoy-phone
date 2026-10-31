-- Additive migration. Run on the phone schema after 001_phone_schema.sql.
CREATE TABLE IF NOT EXISTS phone.contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id text NOT NULL,
 full_name varchar(120) NOT NULL,
 phone_number varchar(20) NOT NULL,
 email varchar(254),
 company varchar(120),
 notes varchar(1000),
 favorite boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_user_name_idx ON phone.contacts(user_id, full_name);
CREATE INDEX IF NOT EXISTS contacts_user_number_idx ON phone.contacts(user_id, phone_number);
CREATE TABLE IF NOT EXISTS phone.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(160) NOT NULL,
 organization_number varchar(9),
 organization_type text NOT NULL CHECK (organization_type IN ('ENK','AS','ASA','ANS','DA','SA','NUF','STIFTELSE','FORENING','ANNET')),
 owner_id text NOT NULL,
 verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_orgno_uq ON phone.organizations(organization_number) WHERE organization_number IS NOT NULL;
CREATE TABLE IF NOT EXISTS phone.organization_members (
 organization_id uuid NOT NULL REFERENCES phone.organizations(id) ON DELETE CASCADE,
 user_id text NOT NULL,
 role text NOT NULL CHECK (role IN ('owner','admin','agent','viewer')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS organization_members_user_idx ON phone.organization_members(user_id);
CREATE TABLE IF NOT EXISTS phone.organization_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES phone.organizations(id) ON DELETE CASCADE,
 email text NOT NULL,
 role text NOT NULL CHECK (role IN ('admin','agent','viewer')),
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT(now()+interval '7 days'),
 accepted_at timestamptz,
 created_by text NOT NULL
);
CREATE TABLE IF NOT EXISTS phone.switchboard_settings (
 organization_id uuid PRIMARY KEY REFERENCES phone.organizations(id) ON DELETE CASCADE,
 greeting varchar(240) NOT NULL DEFAULT 'Velkommen. Du blir satt over.',
 forwarding_number varchar(20),
 fallback_number varchar(20),
 opening_hour smallint NOT NULL DEFAULT 8 CHECK(opening_hour BETWEEN 0 AND 23),
 closing_hour smallint NOT NULL DEFAULT 16 CHECK(closing_hour BETWEEN 0 AND 24),
 timezone varchar(64) NOT NULL DEFAULT 'Europe/Oslo',
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(closing_hour > opening_hour)
);
CREATE TABLE IF NOT EXISTS phone.switchboard_lines (
 organization_id uuid NOT NULL REFERENCES phone.organizations(id) ON DELETE CASCADE,
 phone_number varchar(20) NOT NULL UNIQUE,
 provider text NOT NULL CHECK(provider IN ('telnyx','twilio')),
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,phone_number)
);
CREATE TABLE IF NOT EXISTS phone.phone_provider_events (
 event_id text PRIMARY KEY,
 provider text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
