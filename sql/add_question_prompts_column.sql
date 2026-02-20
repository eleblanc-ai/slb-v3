-- Migration: Add ai_question_prompts column for MCQ per-question prompts
-- This replaces the single ai_individual_prompt with per-question prompts (q1-q5)
-- Run this migration in Supabase SQL Editor

-- Add the new column for MCQ question-specific prompts
-- This stores a JSONB object with keys q1, q2, q3, q4, q5 for each question's prompt
ALTER TABLE lesson_template_fields 
  ADD COLUMN IF NOT EXISTS ai_question_prompts JSONB;

-- Add a comment to document the column structure
COMMENT ON COLUMN lesson_template_fields.ai_question_prompts IS 
'JSON object containing per-question AI prompts for MCQ fields. Structure: { "q1": "...", "q2": "...", "q3": "...", "q4": "...", "q5": "..." }. Each question has a specific focus: q1=Central Idea, q2=Vocabulary, q3=Evidence, q4=Inference, q5=Structure.';

-- Optional: Drop the old ai_individual_prompt column after migration is complete
-- Uncomment this when you're sure all data has been migrated
-- ALTER TABLE lesson_template_fields DROP COLUMN IF EXISTS ai_individual_prompt;
