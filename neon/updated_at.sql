-- Adds updated_at to spare_parts + machines, with a shared BEFORE UPDATE
-- trigger that stamps it whenever ANY column actually changes.
--
-- Runs cleanly against a fresh Neon project OR an existing one — every
-- statement is guarded with IF [NOT] EXISTS or OR REPLACE, so this file
-- is safe to re-run.
--
-- Fires uniformly for all UPDATE paths, including:
--   - client-side .update() from Registry.jsx (edit asset)
--   - the adjust_stock RPC (inline stock maintenance)
--   - the draw_part RPC (draw request decrement)
-- so no RPC bodies need editing.

BEGIN;

-- 1. Columns. DEFAULT NOW() gives existing rows a sane starting timestamp
--    the moment the column is added (Postgres backfills the default).
ALTER TABLE spare_parts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Shared trigger function.
--    The IS DISTINCT FROM guard avoids stamping the row when an UPDATE
--    was a no-op (e.g. the client re-saved unchanged fields). Without it,
--    every re-save would bump the timestamp, making the badge lie.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the trigger to each table. Drop-then-create so this is
--    idempotent even after the function signature changes.
DROP TRIGGER IF EXISTS trg_spare_parts_set_updated_at ON spare_parts;
CREATE TRIGGER trg_spare_parts_set_updated_at
  BEFORE UPDATE ON spare_parts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_machines_set_updated_at ON machines;
CREATE TRIGGER trg_machines_set_updated_at
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Index for future "recently updated" queries / sorting. Optional but
--    cheap on tables this size and it's the query pattern that grows.
CREATE INDEX IF NOT EXISTS idx_spare_parts_updated_at ON spare_parts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_machines_updated_at    ON machines    (updated_at DESC);

COMMIT;

-- Post-run in the Neon Console:
--   1. Data API → "Refresh schema cache" so updated_at appears in
--      /rest/v1/spare_parts and /rest/v1/machines responses.
--   2. Registry.jsx already uses .select('*'), so the client picks up
--      the new column automatically — no App.jsx changes needed.
