-- ============================================================
-- QA Checklist: Supabase tables for admin-managed test sections & items
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1) Sections table
CREATE TABLE IF NOT EXISTS public.qa_checklist_sections (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sort_order  integer NOT NULL DEFAULT 0,
  title       text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 2) Items table (belongs to a section)
CREATE TABLE IF NOT EXISTS public.qa_checklist_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id  uuid NOT NULL REFERENCES public.qa_checklist_sections(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  label       text NOT NULL,
  action      text NOT NULL DEFAULT '',
  expect      text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Indexes for fast ordering
CREATE INDEX IF NOT EXISTS idx_qa_sections_sort ON public.qa_checklist_sections(sort_order);
CREATE INDEX IF NOT EXISTS idx_qa_items_section_sort ON public.qa_checklist_items(section_id, sort_order);

-- 3) Enable RLS
ALTER TABLE public.qa_checklist_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_checklist_items ENABLE ROW LEVEL SECURITY;

-- 4) Read policies — all authenticated users can read
CREATE POLICY "Authenticated users can read sections"
  ON public.qa_checklist_sections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read items"
  ON public.qa_checklist_items FOR SELECT
  TO authenticated
  USING (true);

-- 5) Write policies — only admins can insert/update/delete
--    (checks the profiles table for role = 'admin')
CREATE POLICY "Admins can insert sections"
  ON public.qa_checklist_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update sections"
  ON public.qa_checklist_sections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete sections"
  ON public.qa_checklist_sections FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert items"
  ON public.qa_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update items"
  ON public.qa_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete items"
  ON public.qa_checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6) Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_qa_sections_updated ON public.qa_checklist_sections;
CREATE TRIGGER set_qa_sections_updated
  BEFORE UPDATE ON public.qa_checklist_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_qa_items_updated ON public.qa_checklist_items;
CREATE TRIGGER set_qa_items_updated
  BEFORE UPDATE ON public.qa_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 7) SEED DATA — the 19 existing sections + all items
--    Uses a DO block so IDs are stable for the FK references
-- ============================================================
DO $$
DECLARE
  s_id uuid;
BEGIN

  -- 1 · Authentication & Profile Setup
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (1, '1 · Authentication & Profile Setup') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Sign in (email + password)', 'Visit the app and sign in with a valid account.', 'Redirect to the app shell after successful auth. Loading spinner shows while session/profile loads.'),
    (s_id, 2, 'Sign up (restricted domains)', 'Click "Need an account? Sign up" and register with a @thinkcerca.com or @protonmail.com email.', 'Success message: "Check your email to confirm your account before signing in." Non-allowed domains are rejected.'),
    (s_id, 3, 'Auth view gradient', 'Visit the Sign In / Sign Up view.', 'Background matches the landing page blue-to-white gradient.'),
    (s_id, 4, 'Auth favicon display', 'View the Sign In/Sign Up header logo.', 'Favicon appears above the title inside a white circular background with a soft glow and no clipping.'),
    (s_id, 5, 'Set display name (onboarding)', 'Log in as a new user with no display_name in profiles.', '"Welcome!" form appears pre-filled with email prefix. After saving, name persists across reloads.'),
    (s_id, 6, 'Set password (onboarding)', 'Log in as a user without has_set_password metadata.', '"Set Your Password" form appears. Min 6 chars. Password update succeeds and user remains authenticated.'),
    (s_id, 7, 'Sign out', 'Click Sign Out from the user menu.', 'Session cleared, redirected to Sign In view.');

  -- 2 · Home & Navigation
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (2, '2 · Home & Navigation') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Hero links — builder role', 'Log in as a builder. View the home page.', '"Create a New Lesson" and "Browse Lessons" appear. Template-management links are hidden.'),
    (s_id, 2, 'Hero links — admin role', 'Log in as an admin. View the home page.', 'All four hero links appear: Create Lesson, Browse Lessons, Create Template, Browse Templates.'),
    (s_id, 3, 'Scroll to top on navigation', 'Scroll down on a page, then navigate to another page via a link.', 'Scroll position resets to the top.'),
    (s_id, 4, 'CTA button styling', 'View the home page hero buttons.', 'Primary CTA text is dark blue, secondary CTA text is white.'),
    (s_id, 5, 'Header logo', 'View the header in the main app shell.', 'Logo uses local favicon with a white circular background and no glow.'),
    (s_id, 6, 'Tab title', 'Check the browser tab title.', 'Title includes "Smart Lesson Builder" and "ThinkCERCA".'),
    (s_id, 7, 'User menu', 'Click the user avatar/name in the header.', 'Dropdown shows Admin Dashboard (admin only) and Sign Out.');

  -- 3 · Browse Lesson Templates
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (3, '3 · Browse Lesson Templates') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Templates load', 'Open "Browse Lesson Templates" (edit mode).', 'Template cards load grouped into "Core Templates" and state-specific sections.'),
    (s_id, 2, 'Background gradient', 'View the page background.', 'Blue-to-white gradient matches landing page.'),
    (s_id, 3, 'Card displays correct info', 'Inspect a template card.', 'Shows template name, category badge, state badge (if applicable), "Updated {date} by {name}", and action button.'),
    (s_id, 4, 'Edit template', 'Click "Edit Template" on a card.', 'Navigates to template builder with fields loaded.'),
    (s_id, 5, 'Create mode hides edit actions', 'Open Browse Templates in create mode (?mode=create).', 'Clone and delete icons are hidden. Cards show "Create Lesson" button instead of "Edit Template".'),
    (s_id, 6, 'Clone template', 'Click the copy icon on a template card (edit mode).', 'Clone modal opens with name + state inputs. On confirm, template + fields are cloned with remapped ai_context_field_ids. Success modal appears.'),
    (s_id, 7, 'Delete template', 'Click the X icon on a template card (edit mode).', 'Confirm modal shows. On confirm, template is deleted and removed from list. Cleanup reminder modal appears.'),
    (s_id, 8, 'Back navigation', 'Click Back.', 'Returns to the landing page.');

  -- 4 · Create / Edit Lesson Template
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (4, '4 · Create / Edit Lesson Template') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Create new template', 'Click "Create a New Lesson Template".', 'NameLessonTypeModal opens with name, category (Core ELA / State-specific), and state fields. Checks for duplicate names.'),
    (s_id, 2, 'Add each field type', 'Add text, rich_text, grade_band_selector, dropdown, checklist, image, theme_selector, assign_standards, and mcqs fields.', 'Each renders with correct inputs, labels, helper text, and required indicators.'),
    (s_id, 3, 'Field configuration options', 'Open AddFieldModal and inspect all options.', 'Name, placeholder, helper text, required toggle, AI enabled toggle, required-for-generation toggle, Designer/Builder radio all present.'),
    (s_id, 4, 'Drag & drop reordering', 'Drag fields to reorder within designer or builder sections.', 'Order persists after save and re-renders correctly.'),
    (s_id, 5, 'Required field indicators', 'Mark fields as required.', 'Required indicator visible. Missing field validation works during generation.'),
    (s_id, 6, 'Default standard framework', 'Change "Default Standard Framework" in the template header.', 'MCQ standards dropdown and assign_standards fields default to the selected framework.'),
    (s_id, 7, 'Save template', 'Click "Save Template".', 'Template metadata and all fields persist. Reload shows saved state.'),
    (s_id, 8, 'Test lesson button', 'Click the Beaker icon (Test Lesson).', 'Creates/opens a test lesson instance for this template.'),
    (s_id, 9, 'Background gradient', 'View the page background.', 'Blue-to-white gradient matches landing page.'),
    (s_id, 10, 'Generate button style', 'View the Generate Lesson button.', 'Uses the purple gradient.'),
    (s_id, 11, 'MCQ modal back button', 'Edit an existing MCQs field vs. adding a new one.', 'Back button is hidden in edit mode, available in add-new flow.');

  -- 5 · AI Config (Template Mode)
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (5, '5 · AI Config (Template Mode)') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Open AI config', 'Click the gear icon on a field.', 'Modal loads with system instructions, prompt/question prompts, format requirements, and context fields.'),
    (s_id, 2, 'System instructions', 'View the system instructions field.', 'Default: "You are an AI assistant helping to create educational content..."'),
    (s_id, 3, 'MCQ per-question prompts', 'Open AI config on an MCQ field. View Q1–Q5 tabs.', '5 tabs with per-question labels (Central Idea, Vocabulary, Evidence, Inference, Structure). Each has tab label input, tooltip, standards checkboxes, and prompt editor.'),
    (s_id, 4, 'Vocab standards checkbox', 'Set a grade band and open MCQ AI config. Check "Include Vocab Standards" on a question.', 'Grade-specific vocabulary standards appear in parentheses. Prompt preview includes them in CONTEXT block.'),
    (s_id, 5, 'Main idea standards checkbox', 'Set a grade band and check "Include Main Idea Standards".', 'Grade-specific RI.x.2 standards appear. Prompt preview includes them.'),
    (s_id, 6, 'Mapped standards (non-CCSS)', 'Set Default Standard Framework to BEST or TEKS. Open MCQ AI config.', 'Vocab and main idea standards are mapped to the selected framework (e.g., BEST.ELA.9.V.1).'),
    (s_id, 7, 'Grade-specific standards (single)', 'Set grade level to 9.', 'Only grade 9 standards appear, not grade 10.'),
    (s_id, 8, 'Grade-specific standards (band)', 'Set grade band to 9–10.', 'Both grade 9 and grade 10 standards appear.'),
    (s_id, 9, 'Standards checkbox persistence', 'Check/uncheck standards checkboxes and save. Reopen modal.', 'Settings persist in database (ai_question_prompts column).'),
    (s_id, 10, 'Context field selection', 'Select context fields and save.', 'Selection persists, prompt preview updates, and template config saves.'),
    (s_id, 11, 'Self-context for MCQs', 'Select the MCQ field itself as a context field.', 'Field appears in selectable list and can be toggled.'),
    (s_id, 12, 'Prompt preview', 'Click Preview button in AI config.', 'Full assembled prompt shown in monospace read-only view with all sections (SYSTEM, TASK, FORMAT, CONTEXT).'),
    (s_id, 13, 'Reset All', 'Click "Reset All" (red text) in the modal footer.', 'All fields reset to defaults.');

  -- 6 · Create Lesson
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (6, '6 · Create Lesson') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Load lesson from template', 'Create a lesson from a template.', 'Fields load from template and are editable.'),
    (s_id, 2, 'Pre-form modal on new lesson', 'Create a new lesson.', '2-step wizard: Step 1 "Required for AI Generation", Step 2 "Manual Entry Fields". Continue button.'),
    (s_id, 3, 'Model selector', 'Click the model dropdown.', '"Claude Sonnet 4" and "GPT-4o" available.'),
    (s_id, 4, 'Layout toggle', 'Toggle between "Stacked" and "Side by Side".', 'Layout switches between single-column and two-column view.'),
    (s_id, 5, 'Missing fields modal', 'Trigger generation with empty required context fields.', '"Missing Required Fields" modal appears listing the missing fields.'),
    (s_id, 6, 'Unsaved changes protection', 'Edit a field, then navigate away.', 'Modal with "Cancel", "Discard Changes", and "Save & Leave" buttons.'),
    (s_id, 7, 'Save lesson', 'Click "Save Lesson" (green).', 'Save toast "Lesson saved successfully!" appears. Data persists on reload.'),
    (s_id, 8, 'Auto-save after generation', 'Generate content on a field.', 'Auto-save triggers and persists to Supabase.'),
    (s_id, 9, 'Generate button style', 'View the Generate Lesson button.', 'Purple gradient. Pulsing animation when pre-form is complete.'),
    (s_id, 10, 'Manage cover image button', 'View the Manage Cover Image button.', 'Amber/yellow with adequate contrast.'),
    (s_id, 11, 'Back navigation', 'Click Back.', 'Returns to Browse Lessons.'),
    (s_id, 12, 'Duplicate Content ID — manual save blocked', 'Enter a Content ID that already exists on another lesson. Click "Save Lesson".', '"Duplicate Content ID" modal appears with the conflicting lesson name. Only an "OK" dismiss button — no option to save anyway. User must change the ID before saving.'),
    (s_id, 13, 'Duplicate Content ID — auto-save blocked', 'Create a new lesson (not yet saved). Enter a Content ID that already exists. Trigger auto-save (e.g., generate a field).', 'Auto-save aborts the new-lesson INSERT. Toast warning: "Content ID already in use". Lesson is not created until the duplicate is resolved.');

  -- 7 · AI Config (Lesson Mode)
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (7, '7 · AI Config (Lesson Mode)') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Open AI config', 'Click gear icon on a lesson field.', 'Loads lesson-specific config if present, otherwise template defaults.'),
    (s_id, 2, 'Standards checkboxes (read-only)', 'Open MCQ AI config for a question with standards enabled in template.', '"(Set by Template)" label. Only checked checkboxes visible. Checkboxes disabled.'),
    (s_id, 3, 'Standards checkboxes hidden', 'Open AI config for a question where no standards checkboxes were selected in template.', 'Standards checkbox section does not appear at all.'),
    (s_id, 4, 'Context fields (read-only)', 'View the context fields panel.', 'Yellow border with "(Set by Template)" label. Fields listed but not editable.'),
    (s_id, 5, 'Save lesson config', 'Change prompt text and save.', 'user_ai_config snapshot created/updated for this lesson. Template config unchanged.'),
    (s_id, 6, 'Sync from template', 'Click "Sync from Template".', 'Confirmation modal with "Download current config" backup button. Sync overwrites lesson config and keeps modal open.');

  -- 8 · AI Generation — Text Fields
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (8, '8 · AI Generation — Text Fields') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Single field generation', 'Click the sparkles icon on a text or rich text field.', 'Field updates with AI-generated content.'),
    (s_id, 2, 'Full context delivered (no splitting)', 'Use a long passage (2000+ words) and glossary as context. Generate.', 'AI output references both passage and glossary — no "part 2 of 3" language or missing context.'),
    (s_id, 3, 'Full lesson generation', 'Click "Generate Lesson" to generate all fields.', 'Progress shows "Generating (N/M)...". All AI-enabled fields populated sequentially. Stop button available. Success modal on completion.'),
    (s_id, 4, 'Uses browser SDK (not Vercel proxy)', 'Open DevTools Network tab. Generate a text field.', 'Request goes to api.anthropic.com or api.openai.com directly. No /api/ai/ requests.');

  -- 9 · AI Generation — MCQs
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (9, '9 · AI Generation — MCQs') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'MCQ generation (5 questions)', 'Generate MCQs for an MCQ field.', '5 questions generated with question text, choices A–D, standards in brackets, and answer key.'),
    (s_id, 2, 'Individual question regeneration', 'Click generate on a specific question tab (Q1–Q5).', 'Only that question is regenerated. Other questions unchanged.'),
    (s_id, 3, 'MCQ HTML rendering', 'Generate MCQs and view each question tab.', 'Content renders as rich text/HTML. No raw newline artifacts.'),
    (s_id, 4, 'Per-question standard selection', 'Use the StandardsSearch component on a question tab to select a standard.', 'Selected standard is used as guidance when regenerating that question.'),
    (s_id, 5, 'Standards mapped across frameworks', 'Generate MCQs with a grade band set.', 'Each question has standards from multiple frameworks: [CCSS.RI.8.2; TEKS.ELAR.8.6(A); BEST.ELA.8.R.2.2].'),
    (s_id, 6, 'Standards AI filtering', 'Generate MCQs and check console logs for filtering messages.', 'Each question shows filtering step. At least one standard per framework is retained.'),
    (s_id, 7, 'Per-question prompts used', 'Configure different prompts for Q1–Q5 in AI config. Generate.', 'Each question output aligns with its specific prompt instructions.'),
    (s_id, 8, 'Legacy MCQ normalization', 'Load a lesson with older MCQ content stored as plain text.', 'Content normalized to HTML on load and renders correctly.');

  -- 10 · AI Generation — Images
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (10, '10 · AI Generation — Images') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Image generation', 'Generate an image field.', 'Image appears with URL and alt text. Console shows model used (Gemini or DALL-E fallback).'),
    (s_id, 2, 'Gemini-first with DALL-E fallback', 'Check console logs during image generation.', '"Attempting image generation with Gemini 3 Pro Image..." then either success or "Using DALL-E" fallback.'),
    (s_id, 3, 'Passage summary for image prompts', 'Include a reading passage in context fields. Generate an image.', 'Image prompt incorporates a GPT-3.5 summary of the passage (check console logs).'),
    (s_id, 4, 'Alt text generation', 'Generate an image and check the alt text field.', 'Alt text is auto-generated via GPT-4o Vision. Describes the educational content.'),
    (s_id, 5, 'Supabase storage upload', 'Generate an image and check Supabase storage.', 'Image uploaded to lesson-images bucket. URL stored in field values.'),
    (s_id, 6, 'Uses browser SDK', 'Open DevTools Network tab. Generate an image.', 'Request goes to generativelanguage.googleapis.com (Gemini) or api.openai.com (DALL-E). No /api/ai/ requests.');

  -- 11 · Preview & Export
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (11, '11 · Preview & Export') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Preview lesson', 'Click "Preview Lesson" (Eye icon).', 'PreviewModal renders markdown as HTML. Cover image displayed if available.'),
    (s_id, 2, 'Export markdown', 'Click "Export Lesson Content" (Download icon).', 'ExportModal shows markdown preview. "Download" saves as {ContentID}.md. "Copy to Clipboard" works.'),
    (s_id, 3, 'Export with missing fields', 'Export before filling all required fields.', 'Warning shown. Download and Copy buttons disabled.'),
    (s_id, 4, 'Auto-save before export', 'Make unsaved changes, then click Export.', 'Lesson auto-saves before the export modal opens.');

  -- 12 · Upload Cover Image Modal
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (12, '12 · Upload Cover Image Modal') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Open modal', 'Click "Manage Cover Image".', '"Upload Cover Image to S3" modal. Content ID displayed. 4-step instructions shown.'),
    (s_id, 2, 'Download zip', 'Click "Download Zip File".', 'Zip file downloads containing cover.jpg inside a folder named by Content ID.'),
    (s_id, 3, 'Missing content ID warning', 'Open modal before setting Content ID.', 'Warning shown if Content ID or cover image URL is missing.');

  -- 13 · Browse Lessons
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (13, '13 · Browse Lessons') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Lessons load', 'Open "Browse Lessons".', 'Lesson cards load grouped into Core Lessons and state-specific sections.'),
    (s_id, 2, 'Card info displayed', 'Inspect a lesson card.', 'Thumbnail (or FileText icon), Content ID, template name, state, "Created by" with full name + timestamp, response counts.'),
    (s_id, 3, '"Last updated by" not shown', 'View lesson cards.', '"Last updated by" is NOT displayed. Only "Created by" is shown.'),
    (s_id, 4, 'Copy link', 'Click the link icon on a lesson card.', 'URL copied to clipboard. "Link copied" floating toast appears (2s).'),
    (s_id, 5, 'Archive lesson', 'As lesson creator or admin, click the archive icon.', 'Confirmation modal "Archive Lesson". On confirm, lesson archived and removed from list.'),
    (s_id, 6, 'Archive hidden for non-owners', 'As a non-creator non-admin, view a lesson card.', 'Archive icon is not visible.'),
    (s_id, 7, 'Archived lessons filtered', 'Archive a lesson and reload Browse Lessons.', 'Archived lesson does not appear.'),
    (s_id, 8, 'Delete lesson', 'Click the trash icon (creator/admin only).', 'Confirmation modal uses Content ID (not lesson UUID). Lesson removed on confirm. Images deleted from storage.'),
    (s_id, 9, 'Delete hidden for non-owners', 'As a non-creator non-admin, view a lesson card.', 'Delete icon is not visible.'),
    (s_id, 10, 'Test lessons hidden for non-admins', 'As a builder, view Browse Lessons.', 'Test lessons (is_test=true) are not shown.'),
    (s_id, 11, 'Back navigation', 'Click Back.', 'Returns to the landing page.');

  -- 14 · Lesson Locking
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (14, '14 · Lesson Locking') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Lock acquisition', 'Open a lesson for editing.', 'Lock acquired via acquire_lesson_lock RPC.'),
    (s_id, 2, 'Edit blocking (UI)', 'While locked by another user, try editing fields, generating, or saving.', 'Inputs disabled. Generate and Save buttons grayed out with cursor:not-allowed. Tooltip shows editor name.'),
    (s_id, 3, 'Edit blocking (RLS)', 'Attempt to save changes from a locked session (non-owner).', 'Update fails server-side.'),
    (s_id, 4, 'Lock heartbeat (30s)', 'Keep a lesson open for >1 minute. Watch Supabase RPC calls.', 'refresh_lesson_lock called every 30 seconds.'),
    (s_id, 5, 'Lock expiry', 'Stop activity, wait >5 minutes. Try to open from another user.', 'New user can acquire lock.'),
    (s_id, 6, 'Lock release on tab close', 'Open a lesson, then close the browser tab. Immediately open the same lesson from another tab.', 'Lock released via navigator.sendBeacon. Second tab acquires lock immediately.'),
    (s_id, 7, 'Lock release on page navigation', 'Open a lesson, click Back or navigate away.', 'Lock released. Another tab can immediately acquire it.');

  -- 15 · Admin Dashboard
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (15, '15 · Admin Dashboard') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Admin-only access', 'Visit /admin as a builder.', 'Redirected to home (ProtectedRoute).'),
    (s_id, 2, 'User list', 'Open Admin Dashboard as admin.', 'All users shown with display name, role badge (admin=amber, designer=blue, builder=indigo), approved status, user ID, created date.'),
    (s_id, 3, 'Create new user', 'Click the green "+" button. Fill in email, temp password, role, and approved status.', 'User created via create-user edge function. Success message appears. Form auto-hides after 2s.');

  -- 16 · User Deletion Safety
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (16, '16 · User Deletion Safety') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Delete user with content', 'Delete a user in Supabase that has authored lessons/templates.', 'Lessons/templates remain. created_by/updated_by/locked_by set to null.');

  -- 17 · AI Client — Browser SDK Verification
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (17, '17 · AI Client — Browser SDK Verification') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Text generation — direct SDK', 'Open DevTools Network. Generate a text field.', 'Request to api.anthropic.com or api.openai.com. No /api/ai/ request.'),
    (s_id, 2, 'MCQ generation — direct SDK', 'Open DevTools Network. Generate MCQs.', 'Request to api.anthropic.com or api.openai.com. No /api/ai/ request.'),
    (s_id, 3, 'Image generation — direct SDK', 'Open DevTools Network. Generate an image.', 'Request to generativelanguage.googleapis.com (Gemini) or api.openai.com (DALL-E). No /api/ai/ request.'),
    (s_id, 4, 'Alt text generation — direct SDK', 'Open DevTools Network. Generate alt text.', 'Request to api.openai.com. No /api/ai/ request.'),
    (s_id, 5, 'API keys loaded', 'In dev mode, check browser console: import.meta.env.VITE_ANTHROPIC_API_KEY', 'Key is defined and not empty.');

  -- 18 · AI Context Integrity
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (18, '18 · AI Context Integrity') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Full context delivered (long content)', 'Create a lesson with 2000+ word passage and glossary. Generate an MCQ.', 'AI references both passage and glossary correctly. No "part 2 of 3" language.'),
    (s_id, 2, 'Prompt preview shows complete context', 'Open AI Config for MCQ field with multiple context fields. Click Preview.', 'Full === CONTEXT === section with all fields intact.'),
    (s_id, 3, 'No callAIWithBatchedContext in codebase', 'Search codebase for callAIWithBatchedContext.', 'No imports or calls in any page component.');

  -- 19 · Standards Mapping & CSV
  INSERT INTO public.qa_checklist_sections (sort_order, title) VALUES (19, '19 · Standards Mapping & CSV') RETURNING id INTO s_id;
  INSERT INTO public.qa_checklist_items (section_id, sort_order, label, action, expect) VALUES
    (s_id, 1, 'Mapped standards on MCQs', 'Generate MCQs with a grade band set.', 'Each question includes multi-framework standards in brackets.'),
    (s_id, 2, 'At least one standard per framework', 'Inspect generated MCQ standards.', 'At least one standard from each present framework (CCSS, TEKS, BEST, etc.) retained.'),
    (s_id, 3, 'CSV data loads and caches', 'Open DevTools Network. Generate MCQs twice.', 'MOAC CSV fetched only once (cached after first load).'),
    (s_id, 4, 'Standards filtering console logs', 'Generate MCQs and watch console.', 'Filtering and filtered log messages appear for each question.');

END $$;
