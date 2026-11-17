CREATE TABLE app.procedure (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app.user_account(auth_user_id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180), description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),
 revision_counter integer NOT NULL DEFAULT 1 CHECK(revision_counter>0), archived_at timestamptz,
 creation_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,id)
);
CREATE TABLE app.procedure_step (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, procedure_id uuid NOT NULL, position integer NOT NULL CHECK(position>=0), text text NOT NULL CHECK(length(text) BETWEEN 1 AND 4000),
 UNIQUE(procedure_id,position), FOREIGN KEY(owner_id,procedure_id) REFERENCES app.procedure(owner_id,id) ON DELETE CASCADE
);
CREATE TABLE app.procedure_material (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, procedure_id uuid NOT NULL, position integer NOT NULL CHECK(position>=0),
 specification text NOT NULL CHECK(length(specification) BETWEEN 1 AND 1000), type text NOT NULL CHECK(type IN ('metal','stone','component')),
 unit text NOT NULL, quantity numeric(18,3) CHECK(quantity>=0),
 CHECK((type='metal' AND unit='g') OR (type IN ('stone','component') AND unit='ks')),
 CHECK(unit<>'ks' OR quantity=trunc(quantity)), UNIQUE(procedure_id,position),
 FOREIGN KEY(owner_id,procedure_id) REFERENCES app.procedure(owner_id,id) ON DELETE CASCADE
);
CREATE TABLE app.product (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app.user_account(auth_user_id), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180), description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),
 source text NOT NULL DEFAULT 'school' CHECK(source='school'), status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','done')),
 created_without_procedure boolean NOT NULL, procedure_id uuid, procedure_revision integer,
 saved_procedure_id uuid UNIQUE, row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0), school_cost numeric(20,6) CHECK(school_cost>=0),
 started_at timestamptz, completed_at timestamptz, creation_hash text NOT NULL,
 start_key uuid, start_hash text, complete_key uuid, complete_hash text, saved_procedure_key uuid, saved_procedure_hash text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,id),
 FOREIGN KEY(owner_id,procedure_id) REFERENCES app.procedure(owner_id,id),
 FOREIGN KEY(owner_id,saved_procedure_id) REFERENCES app.procedure(owner_id,id),
 CHECK(created_without_procedure=(procedure_id IS NULL)), CHECK(status<>'done' OR completed_at IS NOT NULL)
);
CREATE TABLE app.product_step (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, product_id uuid NOT NULL, position integer NOT NULL CHECK(position>=0), text text NOT NULL CHECK(length(text) BETWEEN 1 AND 4000),
 is_completed boolean NOT NULL DEFAULT false, completed_at timestamptz, row_version integer NOT NULL DEFAULT 1,
 UNIQUE(owner_id,product_id,id), UNIQUE(product_id,position), FOREIGN KEY(owner_id,product_id) REFERENCES app.product(owner_id,id) ON DELETE CASCADE
);
CREATE TABLE app.product_material (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, product_id uuid NOT NULL, position integer NOT NULL CHECK(position>=0),
 specification text NOT NULL CHECK(length(specification) BETWEEN 1 AND 1000), type text NOT NULL CHECK(type IN ('metal','stone','component')), unit text NOT NULL,
 planned_quantity numeric(18,3) CHECK(planned_quantity>=0), actual_quantity numeric(18,3) CHECK(actual_quantity>=0), actual_confirmed boolean NOT NULL DEFAULT false,
 CHECK(actual_confirmed OR actual_quantity IS NULL), CHECK((type='metal' AND unit='g') OR (type IN ('stone','component') AND unit='ks')),
 CHECK(unit<>'ks' OR ((planned_quantity IS NULL OR planned_quantity=trunc(planned_quantity)) AND (actual_quantity IS NULL OR actual_quantity=trunc(actual_quantity)))),
 UNIQUE(owner_id,product_id,id), UNIQUE(product_id,position), FOREIGN KEY(owner_id,product_id) REFERENCES app.product(owner_id,id) ON DELETE CASCADE
);
CREATE TABLE app.product_procedure_snapshot (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, product_id uuid NOT NULL UNIQUE, source_id uuid, source_revision integer,
 schema_version integer NOT NULL CHECK(schema_version=1), content_json jsonb NOT NULL CHECK(jsonb_typeof(content_json)='object'), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,id),
 FOREIGN KEY(owner_id,product_id) REFERENCES app.product(owner_id,id) ON DELETE CASCADE,
 FOREIGN KEY(owner_id,source_id) REFERENCES app.procedure(owner_id,id)
);
CREATE TABLE app.journal_entry (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, product_id uuid NOT NULL, occurred_at date NOT NULL, body_json jsonb NOT NULL,
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0), creation_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,id),
 CHECK(COALESCE(body_json->>'version'='1' AND body_json->'doc'->>'type'='doc' AND jsonb_typeof(body_json->'doc'->'content')='array',false)),
 FOREIGN KEY(owner_id,product_id) REFERENCES app.product(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX procedure_list ON app.procedure(owner_id,archived_at,updated_at DESC,id DESC);
CREATE INDEX procedure_title ON app.procedure(owner_id,lower(title));
CREATE INDEX product_list ON app.product(owner_id,status,updated_at DESC,id DESC);
CREATE INDEX product_title ON app.product(owner_id,lower(title));
CREATE INDEX journal_chronology ON app.journal_entry(owner_id,product_id,occurred_at,created_at,id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['procedure','procedure_step','procedure_material','product','product_step','product_material','product_procedure_snapshot','journal_entry'] LOOP
  EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owned_active ON app.%I TO craftbook_runtime USING(owner_id=app.context_uuid(''app.user_id'') AND app.account_is_active()) WITH CHECK(owner_id=app.context_uuid(''app.user_id'') AND app.account_is_active())',t);
  EXECUTE format('REVOKE ALL ON app.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON app.%I TO craftbook_runtime',t);
 END LOOP;
END $$;
REVOKE UPDATE,DELETE ON app.product_procedure_snapshot FROM craftbook_runtime;
-- No product/procedure destructive endpoint; runtime cannot bypass this boundary.
REVOKE DELETE ON app.product,app.procedure FROM craftbook_runtime;
ALTER TABLE app.asset_link DROP CONSTRAINT asset_link_pkey;
ALTER TABLE app.asset_link ALTER COLUMN document_id DROP NOT NULL;
ALTER TABLE app.asset_link ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY;
ALTER TABLE app.asset_link ADD COLUMN procedure_id uuid, ADD COLUMN product_id uuid, ADD COLUMN journal_entry_id uuid, ADD COLUMN snapshot_id uuid;
ALTER TABLE app.asset_link ADD FOREIGN KEY(owner_id,procedure_id) REFERENCES app.procedure(owner_id,id) ON DELETE CASCADE,
 ADD FOREIGN KEY(owner_id,product_id) REFERENCES app.product(owner_id,id) ON DELETE CASCADE,
 ADD FOREIGN KEY(owner_id,journal_entry_id) REFERENCES app.journal_entry(owner_id,id) ON DELETE CASCADE,
 ADD FOREIGN KEY(owner_id,snapshot_id) REFERENCES app.product_procedure_snapshot(owner_id,id) ON DELETE CASCADE;
ALTER TABLE app.asset_link DROP CONSTRAINT asset_link_role_check;
ALTER TABLE app.asset_link ADD CONSTRAINT one_asset_target CHECK(num_nonnulls(document_id,procedure_id,product_id,journal_entry_id,snapshot_id)=1);
ALTER TABLE app.asset_link ADD CONSTRAINT asset_target_role CHECK(
 (document_id IS NOT NULL AND role IN ('main','image')) OR (procedure_id IS NOT NULL AND role='attachment') OR
 (product_id IS NOT NULL AND role IN ('attachment','progress','finished')) OR (journal_entry_id IS NOT NULL AND role='image') OR (snapshot_id IS NOT NULL AND role='snapshot'));
CREATE UNIQUE INDEX asset_document_unique ON app.asset_link(document_id,asset_id,role) WHERE document_id IS NOT NULL;
CREATE UNIQUE INDEX asset_procedure_unique ON app.asset_link(procedure_id,asset_id,role) WHERE procedure_id IS NOT NULL;
CREATE UNIQUE INDEX asset_product_unique ON app.asset_link(product_id,asset_id,role) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX asset_journal_unique ON app.asset_link(journal_entry_id,asset_id,role) WHERE journal_entry_id IS NOT NULL;
CREATE UNIQUE INDEX asset_snapshot_unique ON app.asset_link(snapshot_id,asset_id,role) WHERE snapshot_id IS NOT NULL;
CREATE OR REPLACE FUNCTION app.guard_asset_link() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE a app.asset; BEGIN
 IF TG_OP='UPDATE' AND OLD.snapshot_id IS NOT NULL AND current_user='craftbook_runtime' THEN RAISE EXCEPTION 'IMMUTABLE_SNAPSHOT'; END IF;
 SELECT * INTO a FROM app.asset WHERE id=NEW.asset_id AND owner_id=NEW.owner_id FOR UPDATE;
 IF a.id IS NULL OR a.state<>'ready' OR (NEW.role IN ('image','progress','finished') AND a.mime NOT IN ('image/jpeg','image/png','image/webp')) OR (NEW.role='main' AND a.mime NOT IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/markdown')) THEN RAISE EXCEPTION 'ASSET_NOT_READY'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION app.protect_snapshot_reference() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF OLD.snapshot_id IS NOT NULL AND current_user='craftbook_runtime' THEN RAISE EXCEPTION 'IMMUTABLE_SNAPSHOT'; END IF; RETURN OLD;
END $$;
CREATE TRIGGER immutable_snapshot_link BEFORE DELETE ON app.asset_link FOR EACH ROW EXECUTE FUNCTION app.protect_snapshot_reference();
REVOKE ALL ON FUNCTION app.protect_snapshot_reference() FROM PUBLIC;
