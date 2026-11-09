-- Vedoy PBX MVP: separate, opt-in IVR settings for owned Voice numbers.
-- Run after 001_phone_schema.sql. Does not change existing phone/SMS tables.
CREATE TABLE IF NOT EXISTS phone.pbx_menus (
  user_id text PRIMARY KEY,
  phone_number text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  greeting text NOT NULL,
  departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pbx_departments_array CHECK (jsonb_typeof(departments) = 'array')
);
CREATE UNIQUE INDEX IF NOT EXISTS pbx_enabled_number_uq ON phone.pbx_menus(phone_number) WHERE enabled = true;
CREATE TABLE IF NOT EXISTS phone.pbx_call_selections (
  call_sid text PRIMARY KEY,
  user_id text NOT NULL,
  phone_number text NOT NULL,
  digit char(1) NOT NULL,
  department_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pbx_call_selections_owner_idx ON phone.pbx_call_selections(user_id, created_at DESC);
