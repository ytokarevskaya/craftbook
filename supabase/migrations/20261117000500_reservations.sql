-- Remove only the stage-6 zero-reservation guards, preserving nonnegative/sum checks.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conrelid::regclass AS tab,conname FROM pg_constraint WHERE contype='c' AND conrelid IN ('app.inventory_balance'::regclass,'app.inventory_movement'::regclass) AND (pg_get_constraintdef(oid) LIKE '%reserved_quantity =%' OR pg_get_constraintdef(oid) LIKE '%reserved_quantity_delta =%') LOOP
 EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',c.tab,c.conname);END LOOP;END $$;
ALTER TABLE app.product DROP CONSTRAINT product_source_check;
ALTER TABLE app.product ADD CONSTRAINT product_source_check CHECK(source IN ('school','own'));
ALTER TABLE app.inventory_operation DROP CONSTRAINT inventory_operation_scope_check;
ALTER TABLE app.inventory_operation ADD CONSTRAINT inventory_operation_scope_check CHECK(scope IN ('purchase','opening','writeoff','adjustment','own_start','reservations'));
ALTER TABLE app.inventory_movement DROP CONSTRAINT inventory_movement_kind_check;
ALTER TABLE app.inventory_movement ADD CONSTRAINT inventory_movement_kind_check CHECK(kind IN ('opening','purchase','writeoff','adjustment','reserve','release'));
ALTER TABLE app.procedure_material ADD COLUMN requirements_json jsonb NOT NULL DEFAULT '{}';
ALTER TABLE app.product_material ADD COLUMN requirements_json jsonb NOT NULL DEFAULT '{}',ADD COLUMN inventory_item_id uuid,ADD COLUMN reserve_enabled boolean NOT NULL DEFAULT false,ADD COLUMN card_snapshot jsonb;
ALTER TABLE app.product_material ADD FOREIGN KEY(owner_id,inventory_item_id) REFERENCES app.inventory_item(owner_id,id);
CREATE TABLE app.reservation (
 id uuid PRIMARY KEY,sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,owner_id uuid NOT NULL,product_id uuid NOT NULL,product_material_id uuid NOT NULL,item_id uuid NOT NULL,operation_id uuid NOT NULL,
 quantity numeric(18,3) NOT NULL CHECK(quantity>0),known_quantity numeric(30,15) NOT NULL CHECK(known_quantity>=0),unknown_quantity numeric(30,15) NOT NULL CHECK(unknown_quantity>=0),known_value numeric(20,6) NOT NULL CHECK(known_value>=0),
 remaining_quantity numeric(18,3) NOT NULL CHECK(remaining_quantity>=0 AND remaining_quantity<=quantity),remaining_known_quantity numeric(30,15) NOT NULL CHECK(remaining_known_quantity>=0 AND remaining_known_quantity<=known_quantity),remaining_unknown_quantity numeric(30,15) NOT NULL CHECK(remaining_unknown_quantity>=0 AND remaining_unknown_quantity<=unknown_quantity),remaining_known_value numeric(20,6) NOT NULL CHECK(remaining_known_value>=0 AND remaining_known_value<=known_value),
 status text NOT NULL CHECK(status IN ('active','released')),card_snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(owner_id,id),UNIQUE(owner_id,product_id,id),
 CHECK(known_quantity+unknown_quantity=quantity),CHECK(remaining_known_quantity+remaining_unknown_quantity=remaining_quantity),CHECK(known_quantity<>0 OR known_value=0),CHECK(remaining_known_quantity<>0 OR remaining_known_value=0),CHECK((status='released')=(remaining_quantity=0)),
 FOREIGN KEY(owner_id,product_id,product_material_id) REFERENCES app.product_material(owner_id,product_id,id),FOREIGN KEY(owner_id,item_id) REFERENCES app.inventory_item(owner_id,id),FOREIGN KEY(owner_id,operation_id) REFERENCES app.inventory_operation(owner_id,id)
);
CREATE INDEX reservation_product ON app.reservation(owner_id,product_id,sequence);
CREATE INDEX reservation_item ON app.reservation(owner_id,item_id,status,sequence);
ALTER TABLE app.reservation ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.reservation FORCE ROW LEVEL SECURITY;
CREATE POLICY owned_workshop ON app.reservation TO craftbook_runtime USING(owner_id=app.context_uuid('app.user_id') AND app.workshop_enabled()) WITH CHECK(owner_id=app.context_uuid('app.user_id') AND app.workshop_enabled());
REVOKE ALL ON app.reservation FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON app.reservation TO craftbook_runtime;
GRANT UPDATE(remaining_quantity,remaining_known_quantity,remaining_unknown_quantity,remaining_known_value,status,updated_at) ON app.reservation TO craftbook_runtime;
GRANT USAGE ON SEQUENCE app.reservation_sequence_seq TO craftbook_runtime;
ALTER TABLE app.inventory_movement ADD COLUMN product_id uuid,ADD COLUMN reservation_id uuid;
ALTER TABLE app.inventory_movement ADD FOREIGN KEY(owner_id,product_id) REFERENCES app.product(owner_id,id),ADD FOREIGN KEY(owner_id,product_id,reservation_id) REFERENCES app.reservation(owner_id,product_id,id);
ALTER TABLE app.inventory_movement ADD CHECK((kind IN ('reserve','release'))=(reservation_id IS NOT NULL AND product_id IS NOT NULL));
ALTER TABLE app.inventory_movement ADD CHECK(kind NOT IN ('reserve','release') OR (free_quantity_delta+reserved_quantity_delta=0 AND free_known_quantity_delta+reserved_known_quantity_delta=0 AND free_unknown_quantity_delta+reserved_unknown_quantity_delta=0 AND free_known_value_delta+reserved_known_value_delta=0));
CREATE FUNCTION app.guard_reservation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE m app.product_material;p app.product;i app.inventory_item;BEGIN
 SELECT * INTO m FROM app.product_material WHERE id=NEW.product_material_id AND product_id=NEW.product_id;
 SELECT * INTO p FROM app.product WHERE id=NEW.product_id;
 SELECT * INTO i FROM app.inventory_item WHERE id=NEW.item_id;
 IF p.source<>'own' OR m.type<>i.type OR m.unit<>i.unit OR (i.unit='ks' AND (NEW.quantity<>trunc(NEW.quantity) OR NEW.remaining_quantity<>trunc(NEW.remaining_quantity))) THEN RAISE EXCEPTION 'INVALID_RESERVATION';END IF;RETURN NEW;END $$;
CREATE TRIGGER reservation_compatibility BEFORE INSERT OR UPDATE ON app.reservation FOR EACH ROW EXECUTE FUNCTION app.guard_reservation();
CREATE FUNCTION app.guard_product_source() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.source='own' AND NOT app.workshop_enabled() AND current_user='craftbook_runtime' THEN RAISE EXCEPTION 'WORKSHOP_REQUIRED';END IF;
 IF TG_OP='UPDATE' AND OLD.source<>NEW.source THEN RAISE EXCEPTION 'IMMUTABLE_SOURCE';END IF;RETURN NEW;END $$;
CREATE TRIGGER product_source_guard BEFORE INSERT OR UPDATE ON app.product FOR EACH ROW EXECUTE FUNCTION app.guard_product_source();
REVOKE ALL ON FUNCTION app.guard_reservation(),app.guard_product_source() FROM PUBLIC;
DROP POLICY owned_active ON app.product;
CREATE POLICY owned_active ON app.product TO craftbook_runtime USING(owner_id=app.context_uuid('app.user_id') AND app.account_is_active() AND (source='school' OR app.workshop_enabled())) WITH CHECK(owner_id=app.context_uuid('app.user_id') AND app.account_is_active() AND (source='school' OR app.workshop_enabled()));
CREATE OR REPLACE FUNCTION app.guard_inventory_quantity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE u text;q numeric; BEGIN
 SELECT unit INTO u FROM app.inventory_item WHERE id=NEW.item_id;
 IF TG_TABLE_NAME='inventory_balance' THEN
  IF u='ks' AND NEW.reserved_quantity<>trunc(NEW.reserved_quantity) THEN RAISE EXCEPTION 'WHOLE_PIECES';END IF;q:=NEW.free_quantity;
 ELSE q:=NEW.quantity;END IF;
 IF u='ks' AND q<>trunc(q) THEN RAISE EXCEPTION 'WHOLE_PIECES';END IF;RETURN NEW;END $$;
