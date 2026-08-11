ALTER TABLE contagens
  ALTER COLUMN item_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oc_localizacoes_id_oc_produto_id_unique'
  ) THEN
    ALTER TABLE oc_localizacoes
      ADD CONSTRAINT oc_localizacoes_id_oc_produto_id_unique UNIQUE (id, oc_produto_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contagens_valid_reference_check'
  ) THEN
    ALTER TABLE contagens
      ADD CONSTRAINT contagens_valid_reference_check
      CHECK (
        item_id IS NOT NULL
        OR (
          oc_produto_id IS NOT NULL
          AND oc_localizacao_id IS NOT NULL
          AND assignment_id IS NOT NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contagens_assignment_oc_fk'
  ) THEN
    ALTER TABLE contagens
      ADD CONSTRAINT contagens_assignment_oc_fk
      FOREIGN KEY (assignment_id, oc_id)
      REFERENCES oc_assignments (id, oc_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contagens_produto_oc_fk'
  ) THEN
    ALTER TABLE contagens
      ADD CONSTRAINT contagens_produto_oc_fk
      FOREIGN KEY (oc_produto_id, oc_id)
      REFERENCES oc_produtos (id, oc_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contagens_localizacao_produto_fk'
  ) THEN
    ALTER TABLE contagens
      ADD CONSTRAINT contagens_localizacao_produto_fk
      FOREIGN KEY (oc_localizacao_id, oc_produto_id)
      REFERENCES oc_localizacoes (id, oc_produto_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END
$$;
