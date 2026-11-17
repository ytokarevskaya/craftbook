-- Narrow read-only portability exception. Never changes ordinary workshop RLS.
CREATE TABLE app.export_lease (
 slot boolean PRIMARY KEY DEFAULT true CHECK(slot), token uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES app.user_account(auth_user_id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
REVOKE ALL ON app.export_lease FROM PUBLIC, anon, authenticated, craftbook_runtime;
CREATE FUNCTION app.claim_export(p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT app.account_is_active() THEN RAISE EXCEPTION 'ACCOUNT_BLOCKED'; END IF;
 INSERT INTO app.export_lease(slot,token,owner_id,expires_at)
 VALUES(true,p_token,app.context_uuid('app.user_id'),clock_timestamp()+interval '120 seconds')
 ON CONFLICT(slot) DO UPDATE SET token=EXCLUDED.token,owner_id=EXCLUDED.owner_id,expires_at=EXCLUDED.expires_at
 WHERE app.export_lease.expires_at<clock_timestamp();
 RETURN FOUND;
END $$;
CREATE FUNCTION app.release_export(p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM app.export_lease WHERE token=p_token AND owner_id=app.context_uuid('app.user_id');
END $$;
CREATE FUNCTION app.export_records(p_token uuid)
RETURNS TABLE(table_name text,row_json text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE tab text; cols text; owner_col text; rec record; used bigint:=0; count_rows integer:=0;
BEGIN
 IF NOT app.account_is_active() THEN RAISE EXCEPTION 'ACCOUNT_BLOCKED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app.export_lease WHERE token=p_token
  AND owner_id=app.context_uuid('app.user_id') AND expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'EXPORT_LEASE'; END IF;
 FOREACH tab IN ARRAY ARRAY['user_profile','document','procedure','procedure_step','procedure_material',
 'product','product_step','product_material','product_procedure_snapshot','journal_entry',
 'inventory_item','inventory_balance','inventory_operation','purchase','purchase_line','inventory_movement',
 'reservation','product_settlement','settlement_line','asset','asset_link'] LOOP
  owner_col:=CASE WHEN tab='user_profile' THEN 'user_id' ELSE 'owner_id' END;
  -- Convert exact decimals and bigint BEFORE JSON encoding, not after JS parsing.
  SELECT string_agg(format('%L,%s',a.attname,CASE
   WHEN a.atttypid IN ('numeric'::regtype,'int8'::regtype) THEN format('%I::text',a.attname)
   WHEN a.atttypid='timestamptz'::regtype THEN format('to_char(%I AT TIME ZONE ''UTC'',''YYYY-MM-DD"T"HH24:MI:SS.US"Z"'')',a.attname)
   ELSE format('%I',a.attname) END),',' ORDER BY a.attnum)
  INTO cols FROM pg_catalog.pg_attribute a
  WHERE a.attrelid=format('app.%I',tab)::regclass AND a.attnum>0 AND NOT a.attisdropped
   AND a.attname NOT LIKE '%\_hash' ESCAPE '\'
   AND a.attname NOT IN ('request_key','result_json');
  table_name:=tab;row_json:=NULL;RETURN NEXT;
  FOR rec IN EXECUTE format('SELECT jsonb_build_object(%s)::text AS value FROM app.%I WHERE %I=$1',cols,tab,owner_col)
   USING app.context_uuid('app.user_id') LOOP
   count_rows:=count_rows+1;used:=used+octet_length(rec.value);
   IF count_rows>10000 OR used>8388608 THEN RAISE EXCEPTION 'EXPORT_LIMIT'; END IF;
   table_name:=tab;row_json:=rec.value;RETURN NEXT;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION app.claim_export(uuid),app.release_export(uuid),app.export_records(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app.claim_export(uuid),app.release_export(uuid),app.export_records(uuid) TO craftbook_runtime;
