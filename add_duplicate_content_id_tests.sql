-- ============================================================
-- Patch: Add "Duplicate Content ID" test items to section 6 · Create Lesson
-- Run this in the Supabase SQL Editor (safe to re-run — uses ON CONFLICT DO NOTHING)
-- ============================================================

DO $$
DECLARE
  s_id uuid;
BEGIN
  -- Find the existing "6 · Create Lesson" section
  SELECT id INTO s_id
    FROM public.qa_checklist_sections
   WHERE title = '6 · Create Lesson'
   LIMIT 1;

  IF s_id IS NULL THEN
    RAISE EXCEPTION 'Section "6 · Create Lesson" not found. Run the full seed first.';
  END IF;

  -- Item 12: manual save hard block
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect)
  VALUES (
    s_id,
    12,
    'Duplicate Content ID — manual save blocked',
    'Enter a Content ID that already exists on another lesson. Click "Save Lesson".',
    '"Duplicate Content ID" modal appears with the conflicting lesson name. Only an "OK" dismiss button — no option to save anyway. User must change the ID before saving.'
  );

  -- Item 13: auto-save abort
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect)
  VALUES (
    s_id,
    13,
    'Duplicate Content ID — auto-save blocked',
    'Create a new lesson (not yet saved). Enter a Content ID that already exists. Trigger auto-save (e.g., generate a field).',
    'Auto-save aborts the new-lesson INSERT. Toast warning: "Content ID already in use". Lesson is not created until the duplicate is resolved.'
  );

  RAISE NOTICE 'Added 2 duplicate-Content-ID test items to section "%"', '6 · Create Lesson';
END $$;
