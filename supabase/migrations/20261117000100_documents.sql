CREATE TABLE app.document (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app.user_account(auth_user_id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180), kind text NOT NULL CHECK(kind IN ('note','file')),
 body_json jsonb, row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
 creation_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id),
 CHECK((kind='note' AND body_json IS NOT NULL AND body_json->>'version'='1' AND body_json->'doc'->>'type'='doc') OR (kind='file' AND body_json IS NULL))
);
CREATE INDEX document_list ON app.document(owner_id,updated_at DESC,id DESC);
CREATE INDEX document_title ON app.document(owner_id,lower(title));
CREATE TABLE app.asset (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app.user_account(auth_user_id),
 storage_key text NOT NULL UNIQUE, original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 200),
 mime text NOT NULL, bytes integer NOT NULL CHECK(bytes>0 AND bytes<=10485760),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','deleting')),
 checksum text, upload_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), unlinked_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id), CHECK(state<>'ready' OR checksum IS NOT NULL)
);
CREATE INDEX asset_cleanup ON app.asset(state,unlinked_at);
CREATE TABLE app.asset_link (
 owner_id uuid NOT NULL, document_id uuid NOT NULL, asset_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('main','image')), position integer NOT NULL CHECK(position>=0),
 PRIMARY KEY(document_id,asset_id,role),
 FOREIGN KEY(owner_id,document_id) REFERENCES app.document(owner_id,id) ON DELETE CASCADE,
 FOREIGN KEY(owner_id,asset_id) REFERENCES app.asset(owner_id,id)
);
CREATE UNIQUE INDEX document_main ON app.asset_link(document_id) WHERE role='main';
CREATE INDEX asset_references ON app.asset_link(asset_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['document','asset','asset_link'] LOOP
  EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owned_active ON app.%I TO craftbook_runtime USING(owner_id=app.context_uuid(''app.user_id'') AND app.account_is_active()) WITH CHECK(owner_id=app.context_uuid(''app.user_id'') AND app.account_is_active())',t);
  EXECUTE format('REVOKE ALL ON app.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON app.%I TO craftbook_runtime',t);
 END LOOP;
END $$;
-- Ready/deleting and attachment changes serialize on the same asset row.
CREATE FUNCTION app.guard_asset_link() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE a app.asset; BEGIN
 SELECT * INTO a FROM app.asset WHERE id=NEW.asset_id AND owner_id=NEW.owner_id FOR UPDATE;
 IF a.id IS NULL OR a.state<>'ready' OR (NEW.role='image' AND a.mime NOT IN ('image/jpeg','image/png','image/webp')) OR (NEW.role='main' AND a.mime NOT IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/markdown')) THEN RAISE EXCEPTION 'ASSET_NOT_READY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_link_ready BEFORE INSERT OR UPDATE ON app.asset_link FOR EACH ROW EXECUTE FUNCTION app.guard_asset_link();
CREATE FUNCTION app.guard_asset_state() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.state='deleting' AND EXISTS(SELECT 1 FROM app.asset_link WHERE asset_id=NEW.id) THEN RAISE EXCEPTION 'ASSET_REFERENCED'; END IF;
 IF OLD.state='deleting' AND NEW.state<>'deleting' THEN RAISE EXCEPTION 'ASSET_DELETING'; END IF;
 IF OLD.state='ready' AND (NEW.storage_key<>OLD.storage_key OR NEW.checksum IS DISTINCT FROM OLD.checksum OR NEW.mime<>OLD.mime OR NEW.bytes<>OLD.bytes) THEN RAISE EXCEPTION 'IMMUTABLE_ASSET'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_state BEFORE UPDATE ON app.asset FOR EACH ROW EXECUTE FUNCTION app.guard_asset_state();
CREATE FUNCTION app.check_document_main() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE did uuid; k text; n integer; BEGIN
 IF TG_TABLE_NAME='document' THEN did:=COALESCE(NEW.id,OLD.id); ELSE did:=COALESCE(NEW.document_id,OLD.document_id); END IF;
 SELECT kind INTO k FROM app.document WHERE id=did;
 IF k IS NULL THEN RETURN NULL; END IF;
 SELECT count(*) INTO n FROM app.asset_link WHERE document_id=did AND role='main';
 IF (k='file' AND n<>1) OR (k='note' AND n<>0) THEN RAISE EXCEPTION 'DOCUMENT_MAIN_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER document_main_check AFTER INSERT OR UPDATE ON app.document DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_document_main();
CREATE CONSTRAINT TRIGGER link_main_check AFTER INSERT OR UPDATE OR DELETE ON app.asset_link DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_document_main();
REVOKE ALL ON FUNCTION app.guard_asset_link(),app.guard_asset_state(),app.check_document_main() FROM PUBLIC;
