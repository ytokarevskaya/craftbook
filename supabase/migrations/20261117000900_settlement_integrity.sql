ALTER TABLE app.product_settlement ADD CONSTRAINT settlement_complete_cost CHECK(cost_status<>'complete' OR cost IS NOT NULL);
ALTER TABLE app.product_settlement ADD CONSTRAINT settlement_first_revision CHECK((revision=1)=(previous_id IS NULL));
ALTER TABLE app.product_settlement ADD UNIQUE(previous_id);
ALTER TABLE app.settlement_line ADD COLUMN material_snapshot jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(material_snapshot)='object');
ALTER TABLE app.settlement_line ADD UNIQUE(owner_id,product_id,id);
ALTER TABLE app.inventory_movement ADD FOREIGN KEY(owner_id,product_id,settlement_line_id) REFERENCES app.settlement_line(owner_id,product_id,id);
CREATE FUNCTION app.check_settlement_summary() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE k uuid;s app.product_settlement;total numeric;complete boolean;previous_revision integer;BEGIN
 IF current_user<>'craftbook_runtime' THEN RETURN NULL;END IF;
 IF TG_TABLE_NAME='product_settlement' THEN k:=NEW.id;ELSE k:=NEW.settlement_id;END IF;
 SELECT * INTO s FROM app.product_settlement WHERE id=k;
 SELECT coalesce(sum(known_cost),0),coalesce(bool_and(cost_status='complete'),true) INTO total,complete FROM app.settlement_line WHERE settlement_id=k;
 IF s.id IS NULL OR s.known_cost<>total OR (s.cost_status='complete')<>complete THEN RAISE EXCEPTION 'SETTLEMENT_SUMMARY_MISMATCH';END IF;
 IF s.previous_id IS NOT NULL THEN SELECT revision INTO previous_revision FROM app.product_settlement WHERE id=s.previous_id;IF previous_revision<>s.revision-1 THEN RAISE EXCEPTION 'SETTLEMENT_REVISION';END IF;END IF;
 RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER settlement_summary AFTER INSERT ON app.product_settlement DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_settlement_summary();
CREATE CONSTRAINT TRIGGER settlement_line_summary AFTER INSERT ON app.settlement_line DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_settlement_summary();
REVOKE ALL ON FUNCTION app.check_settlement_summary() FROM PUBLIC;
