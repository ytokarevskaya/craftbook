CREATE TABLE app.account_provision_operation (
  id uuid PRIMARY KEY,
  target_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('create','provision','reset','deactivate','password')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','failed','complete','superseded')),
  phase text NOT NULL DEFAULT 'prepared' CHECK (phase IN ('prepared','identity_created','blocked','auth_changed','sessions_revoked','complete')),
  request_key uuid NOT NULL UNIQUE,
  operator_reference text NOT NULL CHECK (char_length(operator_reference) BETWEEN 1 AND 120),
  input_reference text,
  actor_session_id uuid,
  error_code text CHECK (error_code IN ('AUTH_FAILED','DB_FAILED','INTERRUPTED','CONFLICT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_operation_target ON app.account_provision_operation(target_id,created_at);
ALTER TABLE app.account_provision_operation ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.account_provision_operation FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.account_provision_operation FROM PUBLIC,anon,authenticated,service_role,craftbook_runtime;
ALTER TABLE app.user_account ADD COLUMN operation_id uuid REFERENCES app.account_provision_operation(id);

-- Only a status, never profile data. Explicit user/session predicates also apply to the definer.
CREATE FUNCTION app.password_access() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE a app.user_account; started timestamptz;
BEGIN
  SELECT * INTO a FROM app.user_account WHERE auth_user_id=app.context_uuid('app.user_id');
  started := app.current_session_started_at();
  IF a.auth_user_id IS NULL OR started IS NULL OR started < a.sessions_valid_after
     OR NOT EXISTS(SELECT 1 FROM app.user_profile WHERE user_id=a.auth_user_id) THEN RETURN 'blocked'; END IF;
  IF a.status='pending_password' AND a.must_change_password THEN
    IF a.temp_expires_at IS NULL OR a.temp_expires_at <= now() THEN RETURN 'expired'; END IF;
    RETURN 'pending';
  END IF;
  IF a.status='active' AND NOT a.must_change_password AND (a.temp_expires_at IS NULL OR a.temp_expires_at>now()) THEN RETURN 'active'; END IF;
  RETURN 'blocked';
END;
$$;
REVOKE ALL ON FUNCTION app.password_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.password_access() TO craftbook_runtime;

CREATE FUNCTION app.begin_password_change(operation_key uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := app.context_uuid('app.user_id'); access text;
BEGIN
  IF uid IS NULL OR NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('craftbook-account:'||uid::text,0)) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  access := app.password_access();
  IF access NOT IN ('active','pending') THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  INSERT INTO app.account_provision_operation(id,target_id,kind,request_key,operator_reference,actor_session_id,phase)
    VALUES(operation_key,uid,'password',operation_key,'self',app.context_uuid('app.session_id'),'blocked');
  UPDATE app.account_provision_operation SET status='superseded',updated_at=now()
    WHERE target_id=uid AND id<>operation_key AND status IN ('running','failed');
  UPDATE app.user_account SET status='inactive',operation_id=operation_key,sessions_valid_after=clock_timestamp() WHERE auth_user_id=uid;
END;
$$;
REVOKE ALL ON FUNCTION app.begin_password_change(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.begin_password_change(uuid) TO craftbook_runtime;

-- Transitions only for the operation started by this verified session, never a caller-supplied user ID.
CREATE FUNCTION app.advance_password_change(operation_key uuid, next_phase text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := app.context_uuid('app.user_id'); op app.account_provision_operation;
BEGIN
  IF uid IS NULL OR NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('craftbook-account:'||uid::text,0)) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  SELECT * INTO op FROM app.account_provision_operation WHERE id=operation_key AND target_id=uid AND kind='password'
    AND actor_session_id=app.context_uuid('app.session_id') AND status='running' FOR UPDATE;
  IF op.id IS NULL OR NOT EXISTS(SELECT 1 FROM app.user_account WHERE auth_user_id=uid AND operation_id=op.id AND status='inactive') THEN RAISE EXCEPTION 'STALE_OPERATION'; END IF;
  IF next_phase='failed' THEN
    UPDATE app.account_provision_operation SET status='failed',error_code='INTERRUPTED',updated_at=now() WHERE id=op.id; RETURN;
  ELSIF next_phase='auth_changed' AND op.phase='blocked' THEN
    UPDATE app.account_provision_operation SET phase=next_phase,updated_at=now() WHERE id=op.id;
  ELSIF next_phase='complete' AND op.phase='auth_changed' THEN
    UPDATE app.user_account SET status='active',must_change_password=false,temp_expires_at=NULL,sessions_valid_after=clock_timestamp() WHERE auth_user_id=uid AND operation_id=op.id;
    UPDATE app.account_provision_operation SET phase='complete',status='complete',updated_at=now() WHERE id=op.id;
  ELSE RAISE EXCEPTION 'INVALID_PHASE'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION app.advance_password_change(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.advance_password_change(uuid,text) TO craftbook_runtime;
