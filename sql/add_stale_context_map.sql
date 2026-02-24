-- Add stale_context_map column to lessons table.
-- Tracks which AI-enabled fields have stale context (their context fields
-- were edited or regenerated after the AI field was last generated).
-- Shape: { [aiFieldId]: string[] (names of changed context fields) }

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS stale_context_map JSONB DEFAULT '{}';

-- Add context_snapshot_map column to lessons table.
-- Stores a hash of each context field's value at the time the dependent
-- AI field was last generated. Used to detect when edits are reverted.
-- Shape: { [aiFieldId]: { [contextFieldId]: number (hash) } }

ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS context_snapshot_map JSONB DEFAULT '{}';
