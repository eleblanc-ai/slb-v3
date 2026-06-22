-- RLS policy to restrict Asha's templates to asha.makwana@thinkcerca.com only

ALTER TABLE lesson_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing update policies to replace with new ones
DROP POLICY IF EXISTS "Authenticated users can update lesson templates" ON lesson_templates;
DROP POLICY IF EXISTS "Only Asha can edit Asha's templates" ON lesson_templates;
DROP POLICY IF EXISTS "Others can edit non-Asha templates" ON lesson_templates;

-- Policy 1: Only asha.makwana@thinkcerca.com can edit templates containing "Asha's"
CREATE POLICY "Only Asha can edit Asha's templates"
  ON lesson_templates FOR UPDATE TO authenticated
  USING (
    CASE
      WHEN name ILIKE '%Asha''s%' THEN
        auth.jwt()->>'email' = 'asha.makwana@thinkcerca.com'
      ELSE true
    END
  );

-- Policy 2: SELECT remains open to authenticated users
CREATE POLICY "Lesson templates are viewable by authenticated users"
  ON lesson_templates FOR SELECT TO authenticated USING (true);

-- Policy 3: INSERT remains open to authenticated users
CREATE POLICY "Authenticated users can insert lesson templates"
  ON lesson_templates FOR INSERT TO authenticated WITH CHECK (true);

-- Policy 4: DELETE with same restriction as UPDATE
CREATE POLICY "Only Asha can delete Asha's templates"
  ON lesson_templates FOR DELETE TO authenticated
  USING (
    CASE
      WHEN name ILIKE '%Asha''s%' THEN
        auth.jwt()->>'email' = 'asha.makwana@thinkcerca.com'
      ELSE true
    END
  );
