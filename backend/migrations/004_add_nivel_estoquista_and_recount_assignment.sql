ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nivel_estoquista INTEGER;

UPDATE users
SET nivel_estoquista = 1
WHERE role = 'estoquista'
  AND nivel_estoquista IS NULL;

UPDATE users
SET nivel_estoquista = NULL
WHERE role <> 'estoquista'
  AND nivel_estoquista IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_nivel_estoquista_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_nivel_estoquista_role_check
      CHECK (
        (role = 'estoquista' AND nivel_estoquista IN (1, 2, 3))
        OR
        (role <> 'estoquista' AND nivel_estoquista IS NULL)
      );
  END IF;
END
$$;
