-- Add flex_mcq to the lesson_template_fields field_type check constraint
ALTER TABLE lesson_template_fields
  DROP CONSTRAINT IF EXISTS lesson_type_fields_field_type_check;

ALTER TABLE lesson_template_fields
  ADD CONSTRAINT lesson_type_fields_field_type_check
  CHECK (field_type IN (
    'text',
    'rich_text',
    'grade_band_selector',
    'dropdown',
    'checklist',
    'image',
    'theme_selector',
    'assign_standards',
    'mcqs',
    'flex_mcq',
    'section_header'
  ));
