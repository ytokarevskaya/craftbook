ALTER TABLE app.reservation ADD UNIQUE(owner_id,item_id,product_id,id);
ALTER TABLE app.inventory_movement ADD FOREIGN KEY(owner_id,item_id,product_id,reservation_id) REFERENCES app.reservation(owner_id,item_id,product_id,id);
-- Deferred check sees the final state of all price parts and both funds.
CREATE FUNCTION app.check_reserved_fund() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE k uuid;b app.inventory_balance;q numeric;known numeric;unknown numeric;value numeric;BEGIN
 IF current_user<>'craftbook_runtime' THEN RETURN NULL;END IF;
 k:=NEW.item_id;SELECT * INTO b FROM app.inventory_balance WHERE item_id=k;
 SELECT coalesce(sum(remaining_quantity),0),coalesce(sum(remaining_known_quantity),0),coalesce(sum(remaining_unknown_quantity),0),coalesce(sum(remaining_known_value),0) INTO q,known,unknown,value FROM app.reservation WHERE item_id=k;
 IF b.item_id IS NULL OR ROW(b.reserved_quantity,b.reserved_known_quantity,b.reserved_unknown_quantity,b.reserved_known_value) IS DISTINCT FROM ROW(q,known,unknown,value) THEN RAISE EXCEPTION 'RESERVATION_BALANCE_MISMATCH';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER reservation_fund_consistency AFTER INSERT OR UPDATE ON app.reservation DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_reserved_fund();
CREATE CONSTRAINT TRIGGER balance_reservation_consistency AFTER INSERT OR UPDATE ON app.inventory_balance DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_reserved_fund();
REVOKE ALL ON FUNCTION app.check_reserved_fund() FROM PUBLIC;
