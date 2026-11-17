CREATE FUNCTION app.workshop_enabled() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$ SELECT app.account_is_active() AND EXISTS(SELECT 1 FROM app.user_profile WHERE user_id=app.context_uuid('app.user_id') AND has_workshop) $$;
REVOKE ALL ON FUNCTION app.workshop_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.workshop_enabled() TO craftbook_runtime;
CREATE TABLE app.inventory_item (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES app.user_account(auth_user_id),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 180),description text NOT NULL DEFAULT '',
 type text NOT NULL CHECK(type IN ('metal','stone','component')),unit text NOT NULL CHECK(unit IN ('g','ks')),
 alloy text NOT NULL DEFAULT '',fineness text NOT NULL DEFAULT '',form text NOT NULL DEFAULT '',profile text NOT NULL DEFAULT '',dimensions text NOT NULL DEFAULT '',
 archived_at timestamptz,row_version integer NOT NULL DEFAULT 1,creation_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id),CHECK((type='metal')=(unit='g'))
);
CREATE TABLE app.inventory_balance (
 item_id uuid PRIMARY KEY,owner_id uuid NOT NULL,row_version integer NOT NULL DEFAULT 1,
 free_quantity numeric(18,3) NOT NULL DEFAULT 0 CHECK(free_quantity>=0),
 free_known_quantity numeric(30,15) NOT NULL DEFAULT 0 CHECK(free_known_quantity>=0),
 free_unknown_quantity numeric(30,15) NOT NULL DEFAULT 0 CHECK(free_unknown_quantity>=0),
 free_known_value numeric(20,6) NOT NULL DEFAULT 0 CHECK(free_known_value>=0),
 reserved_quantity numeric(18,3) NOT NULL DEFAULT 0 CHECK(reserved_quantity>=0),
 reserved_known_quantity numeric(30,15) NOT NULL DEFAULT 0 CHECK(reserved_known_quantity>=0),
 reserved_unknown_quantity numeric(30,15) NOT NULL DEFAULT 0 CHECK(reserved_unknown_quantity>=0),
 reserved_known_value numeric(20,6) NOT NULL DEFAULT 0 CHECK(reserved_known_value>=0),
 UNIQUE(owner_id,item_id),FOREIGN KEY(owner_id,item_id) REFERENCES app.inventory_item(owner_id,id),
 CHECK(free_known_quantity+free_unknown_quantity=free_quantity),CHECK(free_known_quantity<>0 OR free_known_value=0),
 CHECK(reserved_known_quantity+reserved_unknown_quantity=reserved_quantity),CHECK(reserved_known_quantity<>0 OR reserved_known_value=0),CHECK(reserved_quantity=0 AND reserved_known_value=0)
);
CREATE TABLE app.inventory_operation (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES app.user_account(auth_user_id),scope text NOT NULL CHECK(scope IN ('purchase','opening','writeoff','adjustment')),request_key uuid NOT NULL,payload_hash text NOT NULL,result_json jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,scope,request_key),UNIQUE(owner_id,id)
);
CREATE TABLE app.purchase (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,operation_id uuid NOT NULL UNIQUE,business_date date NOT NULL,supplier text NOT NULL CHECK(length(supplier) BETWEEN 1 AND 180),note text NOT NULL DEFAULT '',row_version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,id),FOREIGN KEY(owner_id,operation_id) REFERENCES app.inventory_operation(owner_id,id)
);
CREATE TABLE app.purchase_line (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,purchase_id uuid NOT NULL,item_id uuid NOT NULL,position integer NOT NULL,quantity numeric(18,3) NOT NULL CHECK(quantity>0),total_cost numeric(20,6) CHECK(total_cost>=0),item_snapshot jsonb NOT NULL,
 UNIQUE(purchase_id,position),UNIQUE(owner_id,id),FOREIGN KEY(owner_id,purchase_id) REFERENCES app.purchase(owner_id,id),FOREIGN KEY(owner_id,item_id) REFERENCES app.inventory_item(owner_id,id)
);
CREATE TABLE app.inventory_movement (
 id uuid PRIMARY KEY,posting_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,owner_id uuid NOT NULL,item_id uuid NOT NULL,operation_id uuid NOT NULL,purchase_line_id uuid,corrects_operation_id uuid,
 kind text NOT NULL CHECK(kind IN ('opening','purchase','writeoff','adjustment')),reason text NOT NULL,posted_at timestamptz NOT NULL DEFAULT clock_timestamp(),item_snapshot jsonb NOT NULL,
 free_quantity_delta numeric(18,3) NOT NULL,
 free_known_quantity_delta numeric(30,15) NOT NULL,
 free_unknown_quantity_delta numeric(30,15) NOT NULL,
 free_known_value_delta numeric(20,6) NOT NULL,
 reserved_quantity_delta numeric(18,3) NOT NULL,
 reserved_known_quantity_delta numeric(30,15) NOT NULL,
 reserved_unknown_quantity_delta numeric(30,15) NOT NULL,
 reserved_known_value_delta numeric(20,6) NOT NULL,
 FOREIGN KEY(owner_id,item_id) REFERENCES app.inventory_item(owner_id,id),FOREIGN KEY(owner_id,operation_id) REFERENCES app.inventory_operation(owner_id,id),FOREIGN KEY(owner_id,corrects_operation_id) REFERENCES app.inventory_operation(owner_id,id),FOREIGN KEY(owner_id,purchase_line_id) REFERENCES app.purchase_line(owner_id,id),
 CHECK(free_known_quantity_delta+free_unknown_quantity_delta=free_quantity_delta),CHECK(reserved_known_quantity_delta+reserved_unknown_quantity_delta=reserved_quantity_delta),CHECK(reserved_quantity_delta=0 AND reserved_known_value_delta=0),CHECK(kind='purchase' OR length(trim(reason))>0)
);
CREATE UNIQUE INDEX inventory_opening_once ON app.inventory_movement(item_id) WHERE kind='opening';
CREATE INDEX inventory_item_list ON app.inventory_item(owner_id,type,name,id);
CREATE INDEX inventory_movement_list ON app.inventory_movement(owner_id,posting_sequence DESC);
CREATE INDEX inventory_movement_item ON app.inventory_movement(owner_id,item_id,posting_sequence DESC);
CREATE INDEX purchase_list ON app.purchase(owner_id,business_date DESC,id DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['inventory_item','inventory_balance','inventory_operation','purchase','purchase_line','inventory_movement'] LOOP
 EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owned_workshop ON app.%I TO craftbook_runtime USING(owner_id=app.context_uuid(''app.user_id'') AND app.workshop_enabled()) WITH CHECK(owner_id=app.context_uuid(''app.user_id'') AND app.workshop_enabled())',t);
 EXECUTE format('REVOKE ALL ON app.%I FROM PUBLIC,anon,authenticated,service_role',t);EXECUTE format('GRANT SELECT,INSERT ON app.%I TO craftbook_runtime',t);
 END LOOP;END $$;
GRANT UPDATE ON app.inventory_item,app.inventory_balance TO craftbook_runtime;
GRANT UPDATE(note,row_version,updated_at) ON app.purchase TO craftbook_runtime;
GRANT USAGE ON SEQUENCE app.inventory_movement_posting_sequence_seq TO craftbook_runtime;
CREATE FUNCTION app.guard_inventory_item() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM app.inventory_movement WHERE item_id=OLD.id) AND ROW(NEW.type,NEW.unit,NEW.alloy,NEW.fineness,NEW.form,NEW.profile,NEW.dimensions) IS DISTINCT FROM ROW(OLD.type,OLD.unit,OLD.alloy,OLD.fineness,OLD.form,OLD.profile,OLD.dimensions) THEN RAISE EXCEPTION 'MATERIAL_HAS_HISTORY';END IF;RETURN NEW;END $$;
CREATE TRIGGER inventory_item_history BEFORE UPDATE ON app.inventory_item FOR EACH ROW EXECUTE FUNCTION app.guard_inventory_item();
CREATE FUNCTION app.guard_inventory_quantity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE u text;q numeric; BEGIN
 SELECT unit INTO u FROM app.inventory_item WHERE id=NEW.item_id;
 IF TG_TABLE_NAME='inventory_balance' THEN q:=NEW.free_quantity;ELSE q:=NEW.quantity;END IF;
 IF u='ks' AND q<>trunc(q) THEN RAISE EXCEPTION 'WHOLE_PIECES';END IF;RETURN NEW;END $$;
CREATE TRIGGER balance_whole BEFORE INSERT OR UPDATE ON app.inventory_balance FOR EACH ROW EXECUTE FUNCTION app.guard_inventory_quantity();
CREATE TRIGGER line_whole BEFORE INSERT ON app.purchase_line FOR EACH ROW EXECUTE FUNCTION app.guard_inventory_quantity();
ALTER TABLE app.asset ADD COLUMN workshop_only boolean NOT NULL DEFAULT false;
DROP POLICY owned_active ON app.asset;
CREATE POLICY owned_active ON app.asset TO craftbook_runtime USING(owner_id=app.context_uuid('app.user_id') AND app.account_is_active() AND (NOT workshop_only OR app.workshop_enabled())) WITH CHECK(owner_id=app.context_uuid('app.user_id') AND app.account_is_active() AND (NOT workshop_only OR app.workshop_enabled()));
CREATE FUNCTION app.guard_asset_scope() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF OLD.workshop_only AND NOT NEW.workshop_only AND current_user='craftbook_runtime' THEN RAISE EXCEPTION 'WORKSHOP_ASSET';END IF;RETURN NEW;END $$;
CREATE TRIGGER sticky_asset_scope BEFORE UPDATE ON app.asset FOR EACH ROW EXECUTE FUNCTION app.guard_asset_scope();
ALTER TABLE app.asset_link ADD COLUMN purchase_id uuid;
ALTER TABLE app.asset_link ADD FOREIGN KEY(owner_id,purchase_id) REFERENCES app.purchase(owner_id,id);
ALTER TABLE app.asset_link DROP CONSTRAINT one_asset_target;
ALTER TABLE app.asset_link ADD CONSTRAINT one_asset_target CHECK(num_nonnulls(document_id,procedure_id,product_id,journal_entry_id,snapshot_id,purchase_id)=1);
ALTER TABLE app.asset_link DROP CONSTRAINT asset_target_role;
ALTER TABLE app.asset_link ADD CONSTRAINT asset_target_role CHECK((document_id IS NOT NULL AND role IN ('main','image')) OR (procedure_id IS NOT NULL AND role='attachment') OR (product_id IS NOT NULL AND role IN ('attachment','progress','finished')) OR (journal_entry_id IS NOT NULL AND role='image') OR (snapshot_id IS NOT NULL AND role='snapshot') OR (purchase_id IS NOT NULL AND role='invoice'));
CREATE UNIQUE INDEX asset_purchase_unique ON app.asset_link(purchase_id,asset_id,role) WHERE purchase_id IS NOT NULL;
CREATE FUNCTION app.guard_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.purchase_id IS NOT NULL THEN
 IF NOT app.workshop_enabled() THEN RAISE EXCEPTION 'WORKSHOP_REQUIRED';END IF;
 UPDATE app.asset SET workshop_only=true WHERE id=NEW.asset_id AND owner_id=NEW.owner_id;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER invoice_scope BEFORE INSERT OR UPDATE ON app.asset_link FOR EACH ROW EXECUTE FUNCTION app.guard_invoice();
REVOKE ALL ON FUNCTION app.guard_inventory_item(),app.guard_inventory_quantity(),app.guard_asset_scope(),app.guard_invoice() FROM PUBLIC;
