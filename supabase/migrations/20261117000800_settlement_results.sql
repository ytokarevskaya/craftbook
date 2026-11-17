ALTER TABLE app.product_settlement ADD COLUMN stock_result jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(stock_result)='array');
