-- Add new field types to the check constraint
-- This allows grade_band_selector, theme_selector, and dropdown field types

ALTER TABLE lesson_template_fields
DROP CONSTRAINT IF EXISTS lesson_type_fields_field_type_check;

ALTER TABLE lesson_template_fields
ADD CONSTRAINT lesson_type_fields_field_type_check 
CHECK (field_type IN ('text', 'rich_text', 'dropdown', 'grade_band_selector', 'theme_selector'));
