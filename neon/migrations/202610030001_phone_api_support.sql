ALTER TABLE phone.phone_numbers
  ALTER COLUMN country_code TYPE varchar(2)
  USING rtrim(country_code)::varchar(2);

CREATE OR REPLACE FUNCTION phone.reserve_phone_number(
  p_user_id text,
  p_phone_number text,
  p_country_code text,
  p_number_type text,
  p_capabilities jsonb,
  p_max integer
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = phone, pg_temp
AS $$
DECLARE
  reserved_id uuid;
  active_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id, 0));

  SELECT count(*) INTO active_count
  FROM phone.phone_numbers
  WHERE user_id = p_user_id
    AND status IN ('active', 'pending');

  IF active_count >= p_max THEN
    RAISE EXCEPTION 'number_limit';
  END IF;

  INSERT INTO phone.phone_numbers
    (user_id, phone_number, country_code, number_type, capabilities, status)
  VALUES
    (p_user_id, p_phone_number, p_country_code, p_number_type, p_capabilities, 'pending')
  RETURNING id INTO reserved_id;

  RETURN reserved_id;
END;
$$;

REVOKE ALL ON FUNCTION phone.reserve_phone_number(text, text, text, text, jsonb, integer) FROM PUBLIC;
