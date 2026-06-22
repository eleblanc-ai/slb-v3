-- Allow the new lesson template category.
-- Run in Supabase SQL editor or apply as a migration.

ALTER TABLE lesson_templates
  DROP CONSTRAINT IF EXISTS lesson_types_category_check;

ALTER TABLE lesson_templates
  DROP CONSTRAINT IF EXISTS lesson_templates_category_check;

ALTER TABLE lesson_templates
  ADD CONSTRAINT lesson_types_category_check
  CHECK (category IN ('Core ELA', 'State-specific', 'Asha''s Experiments'));
