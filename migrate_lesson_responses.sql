-- Migrate lesson responses from field names to field IDs
-- This script updates designer_responses and builder_responses to use field IDs as keys instead of field names

DO $$
DECLARE
  lesson_record RECORD;
  field_record RECORD;
  new_designer_responses JSONB;
  new_builder_responses JSONB;
  old_value JSONB;
BEGIN
  -- Loop through all lessons
  FOR lesson_record IN 
    SELECT id, lesson_template_id, designer_responses, builder_responses 
    FROM lessons 
    WHERE lesson_template_id IS NOT NULL
  LOOP
    RAISE NOTICE 'Processing lesson ID: %', lesson_record.id;
    
    new_designer_responses := '{}'::jsonb;
    new_builder_responses := '{}'::jsonb;
    
    -- Loop through all fields for this template
    FOR field_record IN 
      SELECT id, name, field_for 
      FROM lesson_template_fields 
      WHERE lesson_template_id = lesson_record.lesson_template_id
    LOOP
      -- Check if designer_responses has data under the field name
      IF field_record.field_for = 'designer' AND lesson_record.designer_responses ? field_record.name THEN
        old_value := lesson_record.designer_responses -> field_record.name;
        -- Copy to new structure using field ID
        new_designer_responses := new_designer_responses || jsonb_build_object(field_record.id::text, old_value);
        RAISE NOTICE '  Migrating designer field: % (%) -> %', field_record.name, field_record.id, old_value;
      END IF;
      
      -- Check if builder_responses has data under the field name
      IF field_record.field_for = 'builder' AND lesson_record.builder_responses ? field_record.name THEN
        old_value := lesson_record.builder_responses -> field_record.name;
        -- Copy to new structure using field ID
        new_builder_responses := new_builder_responses || jsonb_build_object(field_record.id::text, old_value);
        RAISE NOTICE '  Migrating builder field: % (%) -> %', field_record.name, field_record.id, old_value;
      END IF;
    END LOOP;
    
    -- Update the lesson with the new structure
    UPDATE lessons 
    SET 
      designer_responses = new_designer_responses,
      builder_responses = new_builder_responses
    WHERE id = lesson_record.id;
    
    RAISE NOTICE '  Updated lesson % with new structure', lesson_record.id;
  END LOOP;
  
  RAISE NOTICE 'Migration complete!';
END $$;

-- Verify the migration
SELECT 
  id,
  lesson_template_id,
  template_name,
  jsonb_object_keys(designer_responses) as designer_keys,
  jsonb_object_keys(builder_responses) as builder_keys
FROM lessons
LIMIT 10;
