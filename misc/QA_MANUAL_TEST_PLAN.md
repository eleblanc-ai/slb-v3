# Manual QA Test Plan (App Behavior)

This document outlines expected behaviors to verify by interacting with the app UI.

## 1) Authentication & Profile Setup
- **Login**
  - Action: Visit the app and log in.
  - Expect: Redirect to the app shell after successful auth.
- **Auth view gradient**
  - Action: Visit Sign In and Sign Up views.
  - Expect: Background matches the landing page blue-to-white gradient.
- **Auth favicon display**
  - Action: View the Sign In/Sign Up header logo.
  - Expect: Favicon appears above the title inside a white circular background with a soft glow and no clipping of the colored dots.
- **Set Display Name**
  - Action: If prompted, set display name.
  - Expect: Name persists across reloads.
- **Set Password**
  - Action: If prompted, set password.
  - Expect: Password update succeeds and user remains authenticated.

## 2) Home / Navigation
- **Role-based nav**
  - Action: Open home and inspect available tiles/buttons.
  - Expect: Admin-only actions (create/browse templates) appear only for admins.
- **Scroll to top**
  - Action: Navigate between pages.
  - Expect: Scroll position resets at top.
- **Landing page CTA styling**
  - Action: View the home page CTA buttons.
  - Expect: Primary CTA text is dark blue, secondary CTA text is white.
- **Header logo/favicon**
  - Action: View the header logo in the main app.
  - Expect: Logo uses local favicon with a white circular background and no glow.
- **Tab title**
  - Action: Inspect the browser tab title.
  - Expect: Title is built from `APP_CONFIG.title` and `APP_CONFIG.owner`.

## 3) Browse Lesson Templates
- **Load list**
  - Action: Open “Browse Lesson Templates”.
  - Expect: Templates list loads with cards.
- **Background gradient**
  - Action: Open “Browse Lesson Templates”.
  - Expect: Background matches the landing page blue-to-white gradient.
- **Back navigation**
  - Action: Click Back on Browse Lesson Templates.
  - Expect: Returns to the landing page.
- **Edit template**
  - Action: Choose a template in edit mode.
  - Expect: Navigates to template builder/editor with fields loaded.
- **Delete template**
  - Action: Delete a template.
  - Expect: Confirmation modal shows and deletion removes it from list.
  - Note: This does **not** confirm cascading deletions of lessons; that depends on DB FK constraints.

## 4) Create / Edit Lesson Template (CreateNewLessonType)
- **Create template**
  - Action: Create a new template and add fields.
  - Expect: Template metadata saved; fields persist on reload.
- **Default Standard Framework**
  - Action: Change “Default Standard Framework” in the template header.
  - Expect: MCQ standards dropdown defaults to the selected framework on the MCQ field UI.
  - Expect: Existing MCQ fields that still match the prior default (or have no framework set) now default to the new framework.
- **Field types**
  - Action: Add each field type (text, rich text, dropdown, checklist, image, MCQs, assign standards, etc.).
  - Expect: Each renders with correct inputs, labels, helper text, and required indicators.
- **Drag & drop ordering**
  - Action: Reorder fields.
  - Expect: Order persists and re-renders correctly.
- **Required fields**
  - Action: Mark fields required.
  - Expect: Required indicator and missing field validation works.
- **Background gradient**
  - Action: Open Create/Edit Lesson Template.
  - Expect: Background matches the landing page blue-to-white gradient.
- **Generate lesson button color**
  - Action: View the Generate Lesson button in template mode.
  - Expect: Button uses the purple gradient.
- **Edit MCQ modal back button**
  - Action: Edit an existing MCQs field and open the modal.
  - Expect: Back button is hidden in edit mode.
  - Action: Add a new MCQs field.
  - Expect: Back button is available in add-new flow.

## 5) AI Config (Template Mode)
- **Open AI config**
  - Action: Open AI config for a field.
  - Expect: Modal loads current config (prompt, instructions, format, context).
- **Vocab standards context block**
  - Action: Set a grade band and open AI config for an MCQ field.
  - Expect: A “Grade-Specific Vocabulary Standards” section appears in the modal.
  - Expect: Prompt preview includes a CONTEXT block listing those standards.
- **Main idea standards context block**
  - Action: Set a grade band and open AI config for an MCQ field.
  - Expect: A "Grade-Specific Main Idea Standards" section appears in the modal.
  - Expect: Standards include RI.x.2 for the grade level.
- **Mapped vocab standards (non‑CCSS default)**
  - Action: Set Default Standard Framework to non‑CCSS (e.g., BEST) and open MCQ AI config.
  - Expect: Vocab standards in the modal/preview are mapped to the selected framework.
- **Mapped main idea standards (non‑CCSS default)**
  - Action: Set Default Standard Framework to non‑CCSS (e.g., BEST) and open MCQ AI config.
  - Expect: Main idea standards in the modal/preview are mapped to the selected framework.
- **Grade-specific standards filtering (single grade)**
  - Action: Set grade level to 9 and open MCQ AI config.
  - Expect: Only grade 9 standards appear (e.g., BEST.ELA.9.V.1), not grade 10.
- **Grade-specific standards filtering (grade band)**
  - Action: Set grade band to 9-10 and open MCQ AI config.
  - Expect: Both grade 9 and grade 10 standards appear (e.g., BEST.ELA.9.V.1 and BEST.ELA.10.V.1.1).
- **Per-question standards inclusion checkboxes (template mode)**
  - Action: In template mode, open MCQ AI config and view Q1-Q5 tabs.
  - Expect: Each question tab shows checkboxes for "Include Vocabulary Standards" and "Include Main Idea Standards".
  - Expect: Checkboxes are editable and show the actual standards codes in parentheses.
  - Expect: When unchecked, standards do not appear in the prompt preview for that question.
  - Expect: When checked, standards appear in the prompt preview for that question.
- **Standards checkbox persistence**
  - Action: Check/uncheck standards inclusion checkboxes and save.
  - Expect: Settings persist in database (ai_question_prompts column).
  - Expect: Reopening the modal shows correct checkbox states.
- **Context selection**
  - Action: Select context fields and save.
  - Expect: Selection persists, preview updates, and template config saves.
- **MCQ question prompts**
  - Action: Update per-question prompts.
  - Expect: Saved prompts persist and are used in generation.
- **Self-context for MCQs**
  - Action: For MCQ field, select itself as a context field.
  - Expect: Field appears in selectable list and can be toggled.

## 6) Create Lesson (CreateNewLesson)
- **Load lesson from template**
  - Action: Create a lesson from a template.
  - Expect: Fields load and are editable.
- **Missing fields modal**
  - Action: Trigger generation with missing required fields.
  - Expect: Missing fields modal appears and highlights missing fields.
- **Unsaved changes protection**
  - Action: Navigate away with unsaved changes.
  - Expect: Unsaved changes modal appears.
- **Generate lesson button color**
  - Action: View the Generate Lesson button.
  - Expect: Button uses the purple gradient.
- **Manage cover image button color**
  - Action: View the Manage Cover Image button.
  - Expect: Button is yellow with adequate contrast for white text.
- **Back navigation**
  - Action: Click Back from Create Lesson.
  - Expect: Returns to Browse Lessons.

## 7) AI Config (Lesson Mode)
- **Open AI config**
  - Action: Open AI config for a lesson field.
  - Expect: Loads lesson-specific config if present, otherwise template defaults.
- **Per-question standards inclusion checkboxes (lesson mode - view only)**
  - Action: In lesson mode, open MCQ AI config for a question with standards checkboxes enabled in the template.
  - Expect: Checkbox section appears with label "(Set by Template)".
  - Expect: Only checkboxes that were checked in the template are visible.
  - Expect: Checkboxes are disabled (not editable).
  - Expect: Text has adequate contrast (darker gray on light background).
- **Standards checkboxes hidden when none selected**
  - Action: In lesson mode, open MCQ AI config for a question where no standards checkboxes were selected in template.
  - Expect: The standards checkbox section does not appear at all.
- **Save lesson config**
  - Action: Change config and save.
  - Expect: `user_ai_config` snapshot created/updated for the lesson.
  - Expect: AI configuration is unchanged for Template
- **Sync from template**
  - Action: Click “Sync from Template”.
  - Expect: Confirmation modal appears.
  - Expect: “Download current config” produces a JSON file for that field.
  - Expect: Sync overwrites lesson config for the field **and keeps the AI config modal open**.

## 8) AI Generation – Text Fields
- **Single field generate**
  - Action: Trigger AI generate on a text or rich text field.
  - Expect: Field updates with AI output.
- **Long context batching**
  - Action: Use a very long passage in context fields.
  - Expect: AI generation returns full content without end truncation.
- **Auto-save after generate**
  - Action: Generate on a lesson field.
  - Expect: Auto-save persists updates to Supabase.

## 9) AI Generation – MCQs
- **MCQ generation**
  - Action: Generate MCQs.
  - Expect: 5 questions formatted properly with answers and standards.
- **MCQ HTML rendering**
  - Action: Generate MCQs and view each question tab.
  - Expect: Question content renders as rich text/HTML (no raw newline artifacts).
- **Legacy MCQ normalization**
  - Action: Load a lesson/template with older MCQ content stored as plain text (newline‑separated).
  - Expect: Content is normalized to HTML on load and renders correctly in the editor.
- **Per-question prompts**
  - Action: Ensure each question uses its configured prompt.
  - Expect: Output aligns with prompt-specific instructions.

## 10) AI Generation – Images
- **Image generation**
  - Action: Generate an image field.
  - Expect: Image appears with URL, alt text, and model metadata.
- **Passage summary for images**
  - Action: Include a passage in context and generate image.
  - Expect: Image prompt includes a GPT‑3.5 summary.
- **Upload to Supabase**
  - Action: Confirm image is uploaded and URL is stored.

## 11) Preview & Export
- **Preview lesson**
  - Action: Preview the lesson.
  - Expect: Markdown renders correctly and cover image displays if available.
- **Export markdown**
  - Action: Export lesson content.
  - Expect: Markdown downloads or appears in modal as expected.

## 12) Upload Cover Image Modal
- **Open modal**
  - Action: Open the cover image modal.
  - Expect: Content ID is shown.
- **Download cover image**
  - Action: Download cover image.
  - Expect: Zip file contains image inside folder named by Content ID.

## 13) Browse Lessons
- **List lessons**
  - Action: Open Browse Lessons.
  - Expect: Cards show content ID, template name, author, and thumbnail if available.
- **Last updated by removed**
  - Action: View lesson cards.
  - Expect: "Last updated by" section is NOT displayed.
  - Expect: Only "Created by" with full name is shown.
- **Copy link**
  - Action: Click the link icon on a lesson card.
  - Expect: Lesson URL is copied and a “Link copied” toast appears.
- **Archive lesson (creator/admin only)**
  - Action: As the lesson creator or admin, click the archive icon.
  - Expect: Confirmation modal appears; on confirm, lesson is archived and removed from list.
  - Action: As a non-creator, non-admin user, view a lesson card.
  - Expect: Archive icon is not visible.
- **Archived lessons filtered**
  - Action: Archive a lesson and reload Browse Lessons.
  - Expect: Archived lesson does not appear in the list.
- **Delete lesson**
  - Action: Delete a lesson.
  - Expect: Confirmation modal uses the lesson content ID (not the lesson ID) and lesson is removed from list on success.
  - Action: As a non-creator, non-admin user, view a lesson card.
  - Expect: Delete icon is not visible.
- **Back navigation**
  - Action: Click Back on Browse Lessons.
  - Expect: Returns to the landing page.

## 14) Lesson Locking
- **Lock acquisition**
  - Action: Open a lesson with another user already editing.
  - Expect: Lock state and owner name display.
- **Edit blocking (UI)**
  - Action: While locked by another user, try editing fields, generating AI, or saving.
  - Expect: Inputs and AI actions are disabled; saves are blocked.
- **Edit blocking (RLS)**
  - Action: Attempt to save changes from a locked session (non‑owner).
  - Expect: Update fails server‑side with a permission error.
- **Lock heartbeat**
  - Action: Keep lesson open >5 minutes.
  - Expect: Lock persists with heartbeat updates.
- **Lock expiry**
  - Action: Stop activity and wait >5 minutes, then try to open/edit from another user.
  - Expect: New user can acquire lock and edit.
- **Lock release on tab close**
  - Action: Open a lesson (acquiring the lock), then close the browser tab.
  - Action: Immediately open the same lesson from another tab or user.
  - Expect: Lock is released and the second tab can acquire the lock without waiting for expiry.
  - Note: Relies on `navigator.sendBeacon` sending the release RPC with `apikey` as a query param and a JSON `Blob` body.
- **Lock release on page navigation**
  - Action: Open a lesson, then click the Back button or navigate to Browse Lessons.
  - Expect: Lock is released (verify by immediately opening the same lesson from another tab).

## 15) User Deletion Safety (Supabase)
- **Delete user with content**
  - Action: Delete a user that has authored lessons/templates.
  - Expect: Lessons/templates remain; `created_by`/`updated_by`/`locked_by` are set to null as applicable.


## 16) AI Client – Direct Browser SDK Calls
- **Text generation uses browser SDK (not Vercel proxy)**
  - Action: Open browser DevTools Network tab, generate a text field.
  - Expect: Request goes to `api.anthropic.com` or `api.openai.com` directly — no `/api/ai/generate-text` request.
- **MCQ generation uses browser SDK**
  - Action: Open DevTools Network tab, generate MCQs.
  - Expect: Requests go to `api.anthropic.com` or `api.openai.com` directly — no `/api/ai/` requests.
- **Image generation uses browser SDK**
  - Action: Open DevTools Network tab, generate a cover image.
  - Expect: Request goes to `generativelanguage.googleapis.com` (Gemini) or `api.openai.com` (DALL-E fallback) — no `/api/ai/generate-image` request.
- **Alt text generation uses browser SDK**
  - Action: Open DevTools Network tab, generate alt text for an image.
  - Expect: Request goes to `api.openai.com` directly — no `/api/ai/generate-alt-text` request.
- **API keys present in env**
  - Action: In browser console, run `import.meta.env.VITE_ANTHROPIC_API_KEY` (dev mode only).
  - Expect: Key is defined and not empty.

## 17) AI Context Integrity (No Prompt Splitting)
- **Full context delivered to AI**
  - Action: Create a lesson with a long reading passage (2000+ words) and glossary. Generate an MCQ.
  - Expect: AI output references both the passage and the glossary correctly — no "part 2 of 3" language.
- **Prompt preview shows complete context**
  - Action: Open AI Config, view prompt preview for an MCQ field with multiple context fields.
  - Expect: Preview shows full `=== CONTEXT ===` section with all context fields intact (not chunked).
- **No callAIWithBatchedContext in use**
  - Action: Search codebase for `callAIWithBatchedContext`.
  - Expect: No imports or calls to this function exist in any page component.

## 18) Standards Mapping & Filtering
- **Standards mapping speed**
  - Action: Generate MCQs and observe console logs for `🔍 Filtering` and `✅ Filtered` messages.
  - Expect: Each filtering step completes (timestamps visible in console). Note: each question requires a separate AI call for filtering.
- **Mapped standards appear on MCQs**
  - Action: Generate MCQs with a grade band set.
  - Expect: Each question includes standards in brackets (e.g., `[CCSS.RI.8.2; TEKS.ELAR.8.6(A); BEST.ELA.8.R.2.2]`).
- **Standards filtering keeps at least one per framework**
  - Action: Generate MCQs and inspect the standards on each question.
  - Expect: At least one standard from each framework present in the mapping (CCSS, TEKS, BEST, etc.) is retained.
- **CSV data loads and caches**
  - Action: Open DevTools Network tab, generate MCQs twice in a row.
  - Expect: The MOAC CSV file is fetched only once (cached after first load).

## Notes
- If any step fails, capture the field name, template, lesson ID, and exact error text.
- For AI output issues, capture the prompt preview and model used.
