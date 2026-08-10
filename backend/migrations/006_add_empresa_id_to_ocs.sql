ALTER TABLE ocs
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ocs_empresa_id_fk'
  ) THEN
    ALTER TABLE ocs
      ADD CONSTRAINT ocs_empresa_id_fk
      FOREIGN KEY (empresa_id)
      REFERENCES empresas (id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END
$$;

UPDATE ocs
SET empresa_id = COALESCE(
  (
    SELECT user_empresas.empresa_id
    FROM user_empresas
    WHERE user_empresas.user_id = ocs.gestor_id
    ORDER BY user_empresas.empresa_id ASC
    LIMIT 1
  ),
  (
    SELECT empresas.id
    FROM empresas
    WHERE empresas.codigo = 'DIMEBRAS_PR'
    LIMIT 1
  )
)
WHERE empresa_id IS NULL;

ALTER TABLE ocs
  ALTER COLUMN empresa_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ocs_empresa_id ON ocs (empresa_id);
