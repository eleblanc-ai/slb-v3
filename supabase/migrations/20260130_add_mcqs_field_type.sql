-- Add 'mcqs' to the field_type check constraint
ALTER TABLE lesson_template_fields
DROP CONSTRAINT IF EXISTS lesson_type_fields_field_type_check;

ALTER TABLE lesson_template_fields
ADD CONSTRAINT lesson_type_fields_field_type_check
CHECK (field_type IN ('text', 'rich_text', 'grade_band_selector', 'theme_selector', 'dropdown', 'checklist', 'image', 'assign_standards', 'mcqs'));
