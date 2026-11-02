-- Draft-only takeaway intake: run on the existing Neon PostgreSQL database.
CREATE SCHEMA IF NOT EXISTS phone;
CREATE TABLE IF NOT EXISTS phone.restaurant_lines (
  user_id text NOT NULL,
  phone_number text NOT NULL PRIMARY KEY,
  restaurant_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS phone.restaurant_order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  restaurant_number text NOT NULL,
  customer_number text,
  source text NOT NULL CHECK(source IN ('sms','phone','app','wolt','foodora')),
  external_id text NOT NULL,
  original_text text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'needs_review' CHECK(status IN ('needs_review','rejected','approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_number,source,external_id)
);
CREATE INDEX IF NOT EXISTS restaurant_drafts_tenant_idx ON phone.restaurant_order_drafts(user_id,created_at DESC);
REVOKE ALL ON phone.restaurant_lines,phone.restaurant_order_drafts FROM PUBLIC;
