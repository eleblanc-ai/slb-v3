-- Add exclude_from_generate_all column to lesson_template_fields
-- This allows template designers to omit specific fields from the "Generate Lesson" button
ALTER TABLE lesson_template_fields
ADD COLUMN IF NOT EXISTS exclude_from_generate_all BOOLEAN DEFAULT false;

COMMENT ON COLUMN lesson_template_fields.exclude_from_generate_all IS
  'When true, this field will be skipped by the Generate Lesson (all fields) button but can still be generated individually.';
