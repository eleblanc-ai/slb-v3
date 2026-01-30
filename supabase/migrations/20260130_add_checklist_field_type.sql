-- Add 'checklist' and 'image' to the field_type check constraint
ALTER TABLE lesson_template_fields
DROP CONSTRAINT IF EXISTS lesson_type_fields_field_type_check;

ALTER TABLE lesson_template_fields
ADD CONSTRAINT lesson_type_fields_field_type_check
CHECK (field_type IN ('text', 'rich_text', 'grade_band_selector', 'theme_selector', 'dropdown', 'checklist', 'image'));

-- Add field_config JSONB column for field-specific configuration
ALTER TABLE lesson_template_fields
ADD COLUMN IF NOT EXISTS field_config JSONB DEFAULT NULL;
