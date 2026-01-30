-- Add user_ai_config column to lessons table
-- This stores lesson-specific AI configuration overrides
ALTER TABLE lessons
ADD COLUMN user_ai_config JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN lessons.user_ai_config IS 'Stores lesson-specific AI configuration overrides. Format: { "field_id": { "ai_prompt": "...", "ai_system_instructions": "...", "ai_format_requirements": "...", "ai_context_instructions": "...", "ai_context_field_ids": [...] } }';
