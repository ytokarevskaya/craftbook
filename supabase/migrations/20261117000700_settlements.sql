ALTER TABLE app.product ADD COLUMN current_settlement_id uuid,ADD COLUMN material_cost numeric(20,6),ADD COLUMN known_material_cost numeric(20,6),ADD COLUMN cost_status text CHECK(cost_status IN ('complete','incomplete')),ADD COLUMN archived_at timestamptz;
CREATE TABLE app.product_settlement (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,product_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),previous_id uuid,operation_id uuid NOT NULL UNIQUE,mode text NOT NULL CHECK(mode IN ('complete','correct','return')),reason text NOT NULL CHECK(length(trim(reason))>0),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),known_cost numeric(20,6) NOT NULL CHECK(known_cost>=0),cost numeric(20,6),cost_status text NOT NULL CHECK(cost_status IN ('complete','incomplete')),
 UNIQUE(owner_id,id),UNIQUE(owner_id,product_id,id),UNIQUE(product_id,revision),FOREIGN KEY(owner_id,product_id) REFERENCES app.product(owner_id,id),FOREIGN KEY(owner_id,product_id,previous_id) REFERENCES app.product_settlement(owner_id,product_id,id),FOREIGN KEY(owner_id,operation_id) REFERENCES app.inventory_operation(owner_id,id),CHECK((cost_status='complete' AND cost=known_cost) OR (cost_status='incomplete' AND cost IS NULL))
);
ALTER TABLE app.product ADD FOREIGN KEY(owner_id,id,current_settlement_id) REFERENCES app.product_settlement(owner_id,product_id,id);
CREATE TABLE app.settlement_line (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,product_id uuid NOT NULL,settlement_id uuid NOT NULL,product_material_id uuid NOT NULL,item_id uuid,
 taken_quantity numeric(18,3) NOT NULL CHECK(taken_quantity>=0),in_product_quantity numeric(18,3) NOT NULL CHECK(in_product_quantity>=0),returned_quantity numeric(18,3) NOT NULL CHECK(returned_quantity>=0),scrap_quantity numeric(18,3) NOT NULL CHECK(scrap_quantity>=0),lost_quantity numeric(18,3) NOT NULL CHECK(lost_quantity>=0),
 price_parts jsonb NOT NULL CHECK(jsonb_typeof(price_parts)='array'),categories jsonb NOT NULL CHECK(jsonb_typeof(categories)='object'),net_amounts jsonb NOT NULL CHECK(jsonb_typeof(net_amounts)='object'),item_snapshot jsonb,known_cost numeric(20,6) NOT NULL CHECK(known_cost>=0),cost_status text NOT NULL CHECK(cost_status IN ('complete','incomplete')),
 UNIQUE(owner_id,id),UNIQUE(settlement_id,product_material_id),CHECK(taken_quantity=in_product_quantity+returned_quantity+scrap_quantity+lost_quantity),CHECK(taken_quantity=0 OR item_id IS NOT NULL),
 FOREIGN KEY(owner_id,product_id,settlement_id) REFERENCES app.product_settlement(owner_id,product_id,id),FOREIGN KEY(owner_id,product_id,product_material_id) REFERENCES app.product_material(owner_id,product_id,id),FOREIGN KEY(owner_id,item_id) REFERENCES app.inventory_item(owner_id,id)
);
CREATE INDEX settlement_history ON app.product_settlement(owner_id,product_id,revision DESC);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['product_settlement','settlement_line'] LOOP
 EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owned_workshop ON app.%I TO craftbook_runtime USING(owner_id=app.context_uuid(''app.user_id'') AND app.workshop_enabled()) WITH CHECK(owner_id=app.context_uuid(''app.user_id'') AND app.workshop_enabled())',t);
 EXECUTE format('REVOKE ALL ON app.%I FROM PUBLIC,anon,authenticated,service_role',t);EXECUTE format('GRANT SELECT,INSERT ON app.%I TO craftbook_runtime',t);
 END LOOP;END $$;
ALTER TABLE app.inventory_operation DROP CONSTRAINT inventory_operation_scope_check;
ALTER TABLE app.inventory_operation ADD CONSTRAINT inventory_operation_scope_check CHECK(scope IN ('purchase','opening','writeoff','adjustment','own_start','reservations','settlement_complete','settlement_correct','settlement_return'));
ALTER TABLE app.inventory_movement DROP CONSTRAINT inventory_movement_kind_check;
ALTER TABLE app.inventory_movement ADD CONSTRAINT inventory_movement_kind_check CHECK(kind IN ('opening','purchase','writeoff','adjustment','reserve','release','consume','take','settlement','compensation'));
DO $$ DECLARE c record;BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='app.inventory_movement'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%reservation_id IS NOT NULL%' LOOP EXECUTE format('ALTER TABLE app.inventory_movement DROP CONSTRAINT %I',c.conname);END LOOP;END $$;
ALTER TABLE app.inventory_movement ADD CONSTRAINT reservation_movement_kind CHECK((kind IN ('reserve','release','consume'))=(reservation_id IS NOT NULL AND product_id IS NOT NULL));
ALTER TABLE app.inventory_movement ADD COLUMN settlement_line_id uuid REFERENCES app.settlement_line(id);
ALTER TABLE app.inventory_movement ADD FOREIGN KEY(owner_id,settlement_line_id) REFERENCES app.settlement_line(owner_id,id);
CREATE FUNCTION app.guard_settlement_line() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE m app.product_material; p app.product;BEGIN
 SELECT * INTO m FROM app.product_material WHERE id=NEW.product_material_id;SELECT * INTO p FROM app.product WHERE id=NEW.product_id;
 IF p.source<>'own' OR (m.unit='ks' AND (NEW.scrap_quantity<>0 OR NEW.taken_quantity<>trunc(NEW.taken_quantity) OR NEW.in_product_quantity<>trunc(NEW.in_product_quantity) OR NEW.returned_quantity<>trunc(NEW.returned_quantity) OR NEW.lost_quantity<>trunc(NEW.lost_quantity))) THEN RAISE EXCEPTION 'INVALID_SETTLEMENT';END IF;RETURN NEW;END $$;
CREATE TRIGGER settlement_line_validation BEFORE INSERT ON app.settlement_line FOR EACH ROW EXECUTE FUNCTION app.guard_settlement_line();
REVOKE ALL ON FUNCTION app.guard_settlement_line() FROM PUBLIC;
