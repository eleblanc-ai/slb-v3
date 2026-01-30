-- Fix RLS policies for profiles table to allow viewing display names

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Create a policy that allows all authenticated users to view all profiles
-- This is needed so users can see who created/updated lessons
CREATE POLICY "Anyone can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Keep the update policy restricted to own profile only
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Keep the insert policy restricted to own profile only
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Verify the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';
