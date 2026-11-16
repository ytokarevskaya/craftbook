-- Canonical schema history. Runtime has no membership in privileged roles.
CREATE ROLE craftbook_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA app;
REVOKE ALL ON SCHEMA app FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA app TO craftbook_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE app.user_account (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_password' CHECK (status IN ('active', 'pending_password', 'inactive', 'disabled')),
  must_change_password boolean NOT NULL DEFAULT true,
  temp_expires_at timestamptz,
  sessions_valid_after timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.user_profile (
  user_id uuid PRIMARY KEY REFERENCES app.user_account(auth_user_id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 80),
  has_workshop boolean NOT NULL DEFAULT false
);
ALTER TABLE app.user_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_account FORCE ROW LEVEL SECURITY;
ALTER TABLE app.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_profile FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC, anon, authenticated, service_role, craftbook_runtime;
GRANT SELECT ON app.user_account, app.user_profile TO craftbook_runtime;
GRANT UPDATE (display_name, has_workshop) ON app.user_profile TO craftbook_runtime;

CREATE FUNCTION app.context_uuid(setting_name text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE value text;
BEGIN
  value := pg_catalog.current_setting(setting_name, true);
  IF value IS NULL OR value !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RETURN NULL; END IF;
  RETURN value::uuid;
END;
$$;
REVOKE ALL ON FUNCTION app.context_uuid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.context_uuid(text) TO craftbook_runtime;

CREATE POLICY own_account ON app.user_account FOR SELECT TO craftbook_runtime
USING (auth_user_id = app.context_uuid('app.user_id'));

-- No caller arguments; cannot enumerate sessions. This is the only privileged read.
CREATE FUNCTION app.current_session_started_at() RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.created_at FROM auth.sessions s
  WHERE s.id = app.context_uuid('app.session_id')
    AND s.user_id = app.context_uuid('app.user_id')
    AND (s.not_after IS NULL OR s.not_after > pg_catalog.now())
$$;
REVOKE ALL ON FUNCTION app.current_session_started_at() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app.current_session_started_at() TO craftbook_runtime;

-- Invoker semantics preserve UserAccount RLS. Account policy does not call this function.
CREATE FUNCTION app.account_is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.user_account a
    WHERE a.auth_user_id = app.context_uuid('app.user_id') AND a.status = 'active'
      AND NOT a.must_change_password
      AND (a.temp_expires_at IS NULL OR a.temp_expires_at > pg_catalog.now())
      AND app.current_session_started_at() >= a.sessions_valid_after
  )
$$;
REVOKE ALL ON FUNCTION app.account_is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.account_is_active() TO craftbook_runtime;
CREATE POLICY own_active_profile ON app.user_profile FOR SELECT TO craftbook_runtime
USING (user_id = app.context_uuid('app.user_id') AND app.account_is_active());
CREATE POLICY update_own_active_profile ON app.user_profile FOR UPDATE TO craftbook_runtime
USING (user_id = app.context_uuid('app.user_id') AND app.account_is_active())
WITH CHECK (user_id = app.context_uuid('app.user_id') AND app.account_is_active());
