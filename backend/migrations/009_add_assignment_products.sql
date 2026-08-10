DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oc_assignments_id_oc_id_unique'
  ) THEN
    ALTER TABLE oc_assignments
      ADD CONSTRAINT oc_assignments_id_oc_id_unique UNIQUE (id, oc_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oc_produtos_id_oc_id_unique'
  ) THEN
    ALTER TABLE oc_produtos
      ADD CONSTRAINT oc_produtos_id_oc_id_unique UNIQUE (id, oc_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_oc_assignments_active_unique
  ON oc_assignments (oc_id)
  WHERE status = 'ativo';

CREATE TABLE IF NOT EXISTS oc_assignment_produtos (
  assignment_id INTEGER NOT NULL,
  oc_id INTEGER NOT NULL,
  oc_produto_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT oc_assignment_produtos_pk PRIMARY KEY (assignment_id, oc_produto_id),
  CONSTRAINT oc_assignment_produtos_assignment_fk
    FOREIGN KEY (assignment_id, oc_id)
    REFERENCES oc_assignments (id, oc_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT oc_assignment_produtos_produto_fk
    FOREIGN KEY (oc_produto_id, oc_id)
    REFERENCES oc_produtos (id, oc_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oc_assignment_produtos_oc_id
  ON oc_assignment_produtos (oc_id);

CREATE INDEX IF NOT EXISTS idx_oc_assignment_produtos_oc_produto_id
  ON oc_assignment_produtos (oc_produto_id);

INSERT INTO oc_assignment_produtos (assignment_id, oc_id, oc_produto_id)
SELECT assignments.id, assignments.oc_id, produtos.id
FROM oc_assignments assignments
INNER JOIN oc_produtos produtos ON produtos.oc_id = assignments.oc_id
WHERE assignments.fase = 'contagem'
  AND assignments.ciclo = 1
ON CONFLICT (assignment_id, oc_produto_id) DO NOTHING;
