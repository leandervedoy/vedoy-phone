CREATE SCHEMA IF NOT EXISTS phone;

CREATE TABLE IF NOT EXISTS phone.phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  phone_number text NOT NULL,
  country_code char(2) NOT NULL,
  number_type text NOT NULL CHECK (number_type IN ('local','mobile','tollFree')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','released','failed')),
  twilio_sid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_number_reserved_uq ON phone.phone_numbers(phone_number) WHERE status IN ('pending','active');
CREATE INDEX IF NOT EXISTS phone_numbers_user_status_idx ON phone.phone_numbers(user_id,status,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_twilio_sid_uq ON phone.phone_numbers(twilio_sid) WHERE twilio_sid IS NOT NULL;

CREATE TABLE IF NOT EXISTS phone.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_sid text NOT NULL UNIQUE,
  user_id text NOT NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text NOT NULL DEFAULT '',
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  status text NOT NULL DEFAULT 'queued',
  error_code text,
  date_created timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_user_date_idx ON phone.messages(user_id,date_created DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON phone.messages(user_id,from_number,to_number,date_created);

CREATE TABLE IF NOT EXISTS phone.call_events (
  call_sid text PRIMARY KEY,
  user_id text NOT NULL,
  status text NOT NULL,
  direction text NOT NULL DEFAULT '',
  from_number text NOT NULL DEFAULT '',
  to_number text NOT NULL DEFAULT '',
  duration_seconds integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_events_user_date_idx ON phone.call_events(user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS phone.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','needs_information')),
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_note text,
  reviewed_by text,
  twilio_address_sid text,
  twilio_compliance_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kyc_submissions_user_date_idx ON phone.kyc_submissions(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS phone.sms_opt_outs (
  user_id text NOT NULL,
  from_number text NOT NULL,
  recipient text NOT NULL,
  source_message_sid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,from_number,recipient)
);
