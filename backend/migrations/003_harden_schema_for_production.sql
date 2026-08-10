ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE contagens
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

UPDATE audit_logs
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = audit_logs.user_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contagens_user_id_fk'
  ) THEN
    ALTER TABLE contagens
      ADD CONSTRAINT contagens_user_id_fk
      FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_user_id_fk'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_user_id_fk
      FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_contagens_user_id ON contagens (user_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ocs_set_updated_at ON ocs;
CREATE TRIGGER trg_ocs_set_updated_at
BEFORE UPDATE ON ocs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_oc_items_set_updated_at ON oc_items;
CREATE TRIGGER trg_oc_items_set_updated_at
BEFORE UPDATE ON oc_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE oc_items
  ALTER COLUMN saldo_sistema TYPE NUMERIC(12,3) USING saldo_sistema::numeric(12,3),
  ALTER COLUMN saldo_contado TYPE NUMERIC(12,3) USING saldo_contado::numeric(12,3),
  ALTER COLUMN diferenca TYPE NUMERIC(12,3) USING diferenca::numeric(12,3);

ALTER TABLE contagens
  ALTER COLUMN quantidade TYPE NUMERIC(12,3) USING quantidade::numeric(12,3);
