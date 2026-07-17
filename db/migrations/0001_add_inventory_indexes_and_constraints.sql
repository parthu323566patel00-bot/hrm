-- Add indexes on frequently-queried FK columns
CREATE INDEX IF NOT EXISTS ix_po_items_purchase_order_id ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_po_items_product_id ON purchase_order_items (product_id);
CREATE INDEX IF NOT EXISTS ix_gr_items_goods_receipt_id ON goods_receipt_items (goods_receipt_id);
CREATE INDEX IF NOT EXISTS ix_gr_items_product_id ON goods_receipt_items (product_id);
CREATE INDEX IF NOT EXISTS ix_ledger_product_id ON inventory_ledger_entries (product_id);
CREATE INDEX IF NOT EXISTS ix_ledger_tenant_id ON inventory_ledger_entries (tenant_id);

-- Composite indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS ix_inventory_batches_tenant_product ON inventory_batches (tenant_id, product_id);
CREATE INDEX IF NOT EXISTS ix_inventory_stocks_tenant_product ON inventory_stocks (tenant_id, product_id);

-- Unique index to prevent duplicate batches per tenant/product/batch_number
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_batches_tenant_product_batch ON inventory_batches (tenant_id, product_id, batch_number);

-- Ensure inventory_stocks uniqueness is tenant-scoped: drop single-column unique if exists, then create composite unique index
ALTER TABLE IF EXISTS inventory_stocks DROP CONSTRAINT IF EXISTS inventory_stocks_product_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_stocks_tenant_product ON inventory_stocks (tenant_id, product_id);

-- Ledger lookup helper index
CREATE INDEX IF NOT EXISTS ix_ledger_reference ON inventory_ledger_entries (reference_type, reference_id);
