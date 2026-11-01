-- Vedoy Phone: audit events. Apply AFTER migration 002 on the Phone API database.
-- Application role must be allowed INSERT/SELECT but should not be able to modify audit history.
CREATE TABLE IF NOT EXISTS phone.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  actor_id text NOT NULL,
  action varchar(80) NOT NULL,
  target_type varchar(48) NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_org_timeline_idx ON phone.audit_events(organization_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_timeline_idx ON phone.audit_events(actor_id,created_at DESC);
-- Append-only safety net; database owners can still change schema, so back up logs separately.
CREATE OR REPLACE FUNCTION phone.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit events are append-only'; END $$;
DROP TRIGGER IF EXISTS audit_events_append_only ON phone.audit_events;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON phone.audit_events
FOR EACH ROW EXECUTE FUNCTION phone.reject_audit_mutation();
