-- Prevent user deletions from cascading to lessons/templates
-- This script drops and recreates FKs to auth.users with ON DELETE SET NULL
-- and makes the FK columns nullable if needed.

DO $$
DECLARE
  tbl text;
  col text;
  constraint_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['lessons','lesson_templates','lesson_template_fields'] LOOP
    FOREACH col IN ARRAY ARRAY['created_by','updated_by','locked_by'] LOOP
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = tbl
          AND column_name = col
      ) THEN
        -- Ensure nullable so SET NULL works
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', tbl, col);

        -- Drop any FK on this column referencing auth.users
        FOR constraint_name IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_attribute a
            ON a.attrelid = c.conrelid
           AND a.attnum = ANY (c.conkey)
          WHERE c.contype = 'f'
            AND c.conrelid = format('public.%I', tbl)::regclass
            AND c.confrelid = 'auth.users'::regclass
            AND a.attname = col
        LOOP
          EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, constraint_name);
        END LOOP;

        -- Recreate FK with ON DELETE SET NULL
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
          tbl,
          tbl || '_' || col || '_fkey',
          col
        );
      END IF;
    END LOOP;
  END LOOP;
END$$;
