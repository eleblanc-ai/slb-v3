-- Add stale_context_map column to lessons table.
-- Tracks which AI-enabled fields have stale context (their context fields
-- were edited or regenerated after the AI field was last generated).
-- Shape: { [aiFieldId]: string[] (names of changed context fields) }

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS stale_context_map JSONB DEFAULT '{}';
