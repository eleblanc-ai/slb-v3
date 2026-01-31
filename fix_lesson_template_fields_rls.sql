-- Fix RLS policies for lesson_template_fields table
-- This adds the missing row-level security policies

ALTER TABLE lesson_template_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lesson template fields are viewable by authenticated users" ON lesson_template_fields;
DROP POLICY IF EXISTS "Authenticated users can insert lesson template fields" ON lesson_template_fields;
DROP POLICY IF EXISTS "Authenticated users can update lesson template fields" ON lesson_template_fields;
DROP POLICY IF EXISTS "Authenticated users can delete lesson template fields" ON lesson_template_fields;

CREATE POLICY "Lesson template fields are viewable by authenticated users"
  ON lesson_template_fields FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lesson template fields"
  ON lesson_template_fields FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lesson template fields"
  ON lesson_template_fields FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete lesson template fields"
  ON lesson_template_fields FOR DELETE TO authenticated USING (true);

-- Fix RLS policies for lessons table

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lessons are viewable by authenticated users" ON lessons;
DROP POLICY IF EXISTS "Authenticated users can insert lessons" ON lessons;
DROP POLICY IF EXISTS "Authenticated users can update lessons" ON lessons;
DROP POLICY IF EXISTS "Authenticated users can delete lessons" ON lessons;
DROP POLICY IF EXISTS "Users can delete own lessons" ON lessons;

CREATE POLICY "Lessons are viewable by authenticated users"
  ON lessons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lessons"
  ON lessons FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lessons"
  ON lessons FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete lessons"
  ON lessons FOR DELETE TO authenticated USING (true);
