-- Add lesson locking columns to prevent concurrent editing
-- Run this migration in Supabase SQL Editor

-- Add columns to track who is currently editing a lesson
ALTER TABLE lessons 
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_by_name TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups on locked lessons
CREATE INDEX IF NOT EXISTS lessons_locked_by_idx ON lessons(locked_by);

-- Function to acquire a lock on a lesson
-- Returns true if lock was acquired, false if lesson is already locked by someone else
CREATE OR REPLACE FUNCTION acquire_lesson_lock(
  p_lesson_id UUID,
  p_user_id UUID,
  p_user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_lock RECORD;
  v_lock_timeout INTERVAL := INTERVAL '5 minutes';
BEGIN
  -- Get current lock status
  SELECT locked_by, locked_by_name, locked_at 
  INTO v_current_lock
  FROM lessons 
  WHERE id = p_lesson_id;
  
  -- If no lock exists, or lock has expired, or user already has the lock
  IF v_current_lock.locked_by IS NULL 
     OR v_current_lock.locked_at < NOW() - v_lock_timeout
     OR v_current_lock.locked_by = p_user_id THEN
    
    -- Acquire or refresh the lock
    UPDATE lessons 
    SET 
      locked_by = p_user_id,
      locked_by_name = p_user_name,
      locked_at = NOW()
    WHERE id = p_lesson_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'locked_by', p_user_id,
      'locked_by_name', p_user_name,
      'locked_at', NOW()
    );
  ELSE
    -- Lesson is locked by someone else
    RETURN jsonb_build_object(
      'success', false,
      'locked_by', v_current_lock.locked_by,
      'locked_by_name', v_current_lock.locked_by_name,
      'locked_at', v_current_lock.locked_at
    );
  END IF;
END;
$$;

-- Function to release a lock on a lesson
CREATE OR REPLACE FUNCTION release_lesson_lock(
  p_lesson_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only release the lock if the user owns it
  UPDATE lessons 
  SET 
    locked_by = NULL,
    locked_by_name = NULL,
    locked_at = NULL
  WHERE id = p_lesson_id 
    AND locked_by = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- Function to refresh a lock (heartbeat)
CREATE OR REPLACE FUNCTION refresh_lesson_lock(
  p_lesson_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE lessons 
  SET locked_at = NOW()
  WHERE id = p_lesson_id 
    AND locked_by = p_user_id;
  
  RETURN FOUND;
END;
$$;
