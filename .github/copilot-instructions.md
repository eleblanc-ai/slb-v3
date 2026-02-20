# Smart Lesson Builder v2 (Vite + React + Supabase)
//no need to explain your thinking in great detail, just provide the completed code. thanks!

Always refer to this document when working on the Smart Lesson Builder codebase. It outlines architecture, conventions, and key patterns to ensure consistency across the project.


Always take the time to confirm that changes you make do not break or revert existing functionality. Test thoroughly, especially for complex features like AI generation and lesson exporting.

## Scope and entry points
- Primary app lives in src/; a legacy/alternate app exists in slb-3.3/ (avoid cross-editing unless requested).
- Routing and auth live in [src/App.jsx](src/App.jsx): Supabase session + profile loading, then app routes.
- `Layout` passes `session`/`profile` via `Outlet` context; page components call `useOutletContext()` (see [src/components/layout/Layout.jsx](src/components/layout/Layout.jsx)).

## Configuration-driven UI
- Navigation, hero, footer, and role-gated links are driven by [src/config.js](src/config.js).
- Role filtering is centralized in `filterLinksByRole()` (see [src/lib/roleUtils.js](src/lib/roleUtils.js)); use `roles: null` for public, or arrays for auth-only.

## Data model and Supabase patterns
- Core tables: `lesson_templates`, `lesson_template_fields`, `lessons` (see SQL scripts like [add_lesson_lock.sql](add_lesson_lock.sql) and [migrate_lesson_responses.sql](migrate_lesson_responses.sql)).
- Lesson responses are JSONB keyed by **field IDs** (not names) in `designer_responses` / `builder_responses`; see usage in [src/components/pages/CreateNewLesson.jsx](src/components/pages/CreateNewLesson.jsx).
- Template cloning copies fields and remaps `ai_context_field_ids` (see [src/components/pages/BrowseLessonTemplates.jsx](src/components/pages/BrowseLessonTemplates.jsx)).

## Lesson locking (multi-editor safety)
- Supabase RPCs: `acquire_lesson_lock`, `refresh_lesson_lock`, `release_lesson_lock` (defined in [add_lesson_lock.sql](add_lesson_lock.sql)).
- Client heartbeat runs every 30s and releases on unload in [src/components/pages/CreateNewLesson.jsx](src/components/pages/CreateNewLesson.jsx).

## AI generation conventions
- AI calls are proxied through server-side Vercel functions in `api/ai/`; the browser client is [src/services/aiClient.js](src/services/aiClient.js). Server env keys (no `VITE_` prefix): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`.
- Prompts use structured sections (`=== SYSTEM INSTRUCTIONS ===`, `=== TASK ===`, `=== FORMAT REQUIREMENTS ===`, `=== CONTEXT ===`) built by `buildFullPrompt()` in [src/ai/promptBuilder.js](src/ai/promptBuilder.js).

## Export pipeline
- Markdown exports are per-template functions under `src/export/templates/`; helper generators live in [src/export/generateMarkdownExportFile.js](src/export/generateMarkdownExportFile.js).
- Create/bind export mappings in [src/components/pages/CreateNewLesson.jsx](src/components/pages/CreateNewLesson.jsx).

## Developer workflows
- Install + dev server: `npm install`, `npm run dev` (Vite on http://localhost:5174; see [vite.config.js](vite.config.js)).
- Supabase config in .env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see [README.md](README.md)).

## UI patterns
- Page components often use inline styles and Lucide icons; keep that style consistent (examples in [src/components/pages/BrowseLessons.jsx](src/components/pages/BrowseLessons.jsx)).