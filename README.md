# Smart Lesson Builder

A role-based lesson authoring platform built with React, Supabase, and AI. Admins create lesson templates with configurable fields, builders fill in those templates to produce lessons, and the app uses Anthropic/OpenAI/Gemini to generate content, images, and standards alignment.

**Stack:** React 18 · Vite · Supabase (auth + Postgres + storage) · Vercel (hosting) · Vitest


## Key Features

- **Template-based lesson authoring** — Admins define lesson structures with typed fields (text, rich text, dropdown, checklist, MCQs, image, standards). Builders fill them in.
- **AI-powered content generation** — Any field can be AI-enabled with configurable prompts, context fields, and model selection. Supports Anthropic Claude, OpenAI GPT-4o, and Google Gemini.
- **Standards alignment** — Automatic CCSS ↔ TEKS/BEST/BLOOM/GSE mapping from a bundled MOAC crosswalk CSV. AI-assisted filtering to relevant standards per question.
- **Multi-editor locking** — Lesson lock RPCs with 30-second heartbeat prevent concurrent edits.
- **Markdown/DOCX export** — Per-template export formatters generate downloadable lesson documents.
- **Drag-and-drop field ordering** — Reorder template fields with `@dnd-kit`.
- **Rich text editing** — TipTap editor with headings, bold, italic, underline, and color.
- **Image generation** — Gemini-first with DALL-E fallback, plus GPT-4o Vision alt text generation.
- **Configuration-driven UI** — Navigation, hero, footer, and role-gated links all controlled from `src/config.js`.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Local Dev)](#quick-start-local-dev)
3. [Environment Variables](#environment-variables)
4. [Supabase Setup](#supabase-setup)
5. [Deploy to Vercel](#deploy-to-vercel)
6. [Project Structure](#project-structure)
7. [User Roles](#user-roles)
8. [Key Features](#key-features)
9. [AI Integration](#ai-integration)
10. [Testing](#testing)
11. [Scripts Reference](#scripts-reference)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ (tested on 24.x) | `node -v` to check |
| npm | 9+ | Ships with Node |
| Supabase project | — | Free tier works: [supabase.com](https://supabase.com) |
| Vercel account | — | For production deployment: [vercel.com](https://vercel.com) |

You will also need API keys for **at least one** AI provider:
- [Anthropic](https://console.anthropic.com/) (Claude — text generation)
- [OpenAI](https://platform.openai.com/) (GPT-4o — function calling, alt text, DALL-E images)
- [Google AI](https://aistudio.google.com/) (Gemini — image generation)

---

## Quick Start (Local Dev)

```bash
# 1. Clone and install
git clone <repo-url>
cd v2
npm install --legacy-peer-deps

# 2. Create your .env file (see Environment Variables below)
cp .env.example .env   # or create manually

# 3. Start dev server
npm run dev
```

The app opens at **http://localhost:5174**. AI calls go directly to provider APIs from the browser — no server proxy needed.

---

## Environment Variables

Create a `.env` file in the project root with these keys:

```env
# ── Supabase (required) ──────────────────────────
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key

# ── AI API keys (at least one recommended) ───────
VITE_ANTHROPIC_API_KEY=sk-ant-...     # Claude (text generation)
VITE_OPENAI_API_KEY=sk-...            # GPT-4o (function calling, alt text, DALL-E)
VITE_GOOGLE_API_KEY=AI...             # Gemini (image generation)
```

> **How it works:** The `VITE_` prefix is required so Vite injects them into the browser bundle via `import.meta.env`. The AI SDKs (`@anthropic-ai/sdk`, `openai`, `@google/generative-ai`) are initialized directly in the browser with these keys using `dangerouslyAllowBrowser: true`.

For **Vercel production**, set the same `VITE_`-prefixed keys in your project's Environment Variables settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ANTHROPIC_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_GOOGLE_API_KEY`

---

## Supabase Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com), create a new project, and grab:
- **Project URL** → `VITE_SUPABASE_URL`
- **Anon public key** (Settings → API) → `VITE_SUPABASE_ANON_KEY`

### 2. Run Database Migrations

In the Supabase SQL Editor, run these scripts from the `sql/` folder **in order**:

| Script | Purpose |
|--------|---------|
| `sql/fix_profiles_rls.sql` | Creates `profiles` table with RLS policies, auto-create trigger on signup |
| `sql/fix_lesson_template_fields_rls.sql` | Creates `lesson_templates` + `lesson_template_fields` tables with RLS |
| `sql/migrate_lesson_responses.sql` | Creates `lessons` table with JSONB response columns |
| `sql/add_lesson_lock.sql` | Adds lesson locking RPCs for multi-editor safety |
| `sql/add_question_prompts_column.sql` | Adds AI prompt config column to template fields |
| `sql/fix_user_delete_cascade.sql` | Cascade-deletes profile when auth user is removed |

### 3. Enable Auth Providers

In Supabase Dashboard → Authentication → Providers, ensure **Email** is enabled.

### 4. Create Your First Admin User

1. Start the dev server (`npm run dev`) and sign up at `/sign-in`
2. Complete the onboarding (display name + password)
3. In Supabase Table Editor → `profiles`, find your row and set:
   - `role` → `admin`
   - `approved` → `true`
4. Refresh the app — you now have admin access

---

## Deploy to Vercel

```bash
# Install Vercel CLI (if not already)
npm i -g vercel

# Deploy from project root
vercel
```

Or connect your GitHub repo in the Vercel dashboard for automatic deploys.

**Vercel settings:**
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install --legacy-peer-deps`
- **Environment Variables:** Set all keys from the [Environment Variables](#environment-variables) section

The `vercel.json` configures SPA rewrites for client-side routing.

---

## Project Structure

```
v2/
├── api/                          # Vercel serverless functions
│   └── generate-markdown-export.js  #   Markdown export endpoint
│
├── src/
│   ├── App.jsx                  # Root: auth, routing, session management
│   ├── config.js                # UI configuration (nav, hero, footer, roles)
│   │
│   ├── ai/                      # AI prompt/response logic
│   │   ├── promptBuilder.js     #   Structured prompt assembly
│   │   └── responseBuilder.js   #   AI response → field value parsing
│   │
│   ├── components/
│   │   ├── auth/                # Login, SetDisplayName, SetPassword, ProtectedRoute
│   │   ├── core/                # TipTapEditor, ToastProvider
│   │   ├── fields/              # Field renderers (Text, RichText, Dropdown, MCQs, Image, etc.)
│   │   ├── layout/              # Header, Footer, HeroSection, Layout, ScrollToTop
│   │   ├── modals/              # 12 modal dialogs + ai-config/ sub-components
│   │   └── pages/               # Route-level pages
│   │       ├── HomePage.jsx
│   │       ├── BrowseLessons.jsx
│   │       ├── BrowseLessonTemplates.jsx
│   │       ├── CreateNewLesson.jsx
│   │       ├── CreateNewLessonType.jsx
│   │       ├── AdminDashboard.jsx
│   │       └── TestDashboard.jsx    # Dev-only: test results + coverage viewer
│   │
│   ├── export/                  # Markdown/DOCX export pipeline
│   │   ├── generateMarkdownExportFile.js
│   │   └── templates/           #   Per-template export formatters
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useFieldCRUD.js      #   Template field CRUD operations
│   │   ├── useLessonLock.js     #   Multi-editor locking with heartbeat
│   │   └── useToast.js          #   Toast notification hook
│   │
│   ├── lib/                     # Pure utility functions
│   │   ├── dragUtils.js         #   Drag-and-drop field reordering
│   │   ├── fieldValueUtils.js   #   Field value validation
│   │   ├── roleUtils.js         #   Role-based link filtering
│   │   ├── sanitize.js          #   DOMPurify HTML sanitization
│   │   └── standardsMapper.js   #   CCSS ↔ TEKS/BEST/GSE standards mapping
│   │
│   ├── services/                # External service clients
│   │   ├── aiClient.js          #   Browser-side AI client (direct SDK calls)
│   │   └── supabaseClient.js    #   Supabase client initialization
│   │
│   ├── styles/                  # CSS
│   │   └── Layout.css
│   │
│   └── test/                    # Vitest test suites (150 tests)
│       ├── ai/                  #   promptBuilder tests
│       ├── components/          #   ProtectedRoute, ToastProvider tests
│       ├── hooks/               #   lessonLock tests
│       └── lib/                 #   aiClient, fieldValueUtils, roleUtils, etc.
│
├── docs/                        # Developer documentation
│   ├── PROMPT_BUILDING_GUIDE.md
│   ├── QA_MANUAL_TEST_PLAN.md
│   └── LOCK_CONTENTION_TEST.md
│
├── sql/                         # Supabase database migrations (run in order)
│   ├── fix_profiles_rls.sql
│   ├── fix_lesson_template_fields_rls.sql
│   ├── migrate_lesson_responses.sql
│   ├── add_lesson_lock.sql
│   ├── add_question_prompts_column.sql
│   └── fix_user_delete_cascade.sql
│
├── vercel.json                  # Vercel config (function timeouts, SPA rewrite)
├── vite.config.js               # Vite config (build, dev server, test)
└── package.json
```

---

## User Roles

| Role | Can do |
|------|--------|
| **admin** | Everything — create/edit templates, create/edit lessons, manage users, access admin dashboard |
| **builder** | Create and edit lessons from templates, use AI generation, export completed lessons |

Roles are stored in the `profiles` table and enforced both in the UI (via `filterLinksByRole()` in `src/lib/roleUtils.js`) and at the route level (via `ProtectedRoute`).

New users sign up as builders by default. Admins approve and promote users from the Admin Dashboard (`/admin`).


---

## AI Integration

AI calls are made directly from the browser using the provider SDKs (`@anthropic-ai/sdk`, `openai`, `@google/generative-ai`). The central client is `src/services/aiClient.js`.

| Function | Provider(s) | Used for |
|----------|-------------|----------|
| `callAI()` | Anthropic Claude, OpenAI GPT | Text generation for any field |
| `callAIWithFunction()` | Anthropic Claude, OpenAI GPT | Structured output (MCQs, JSON) |
| `generateImage()` | Google Gemini → OpenAI DALL-E | Lesson images (Gemini first, DALL-E fallback) |
| `generateAltText()` | OpenAI GPT-4o Vision | Alt text for generated images |
| `summarizePassageForImage()` | OpenAI GPT-3.5 | Passage summary for image prompt guidance |

Prompts are built using structured sections (`=== SYSTEM INSTRUCTIONS ===`, `=== TASK ===`, `=== FORMAT REQUIREMENTS ===`, `=== CONTEXT ===`) — see `src/ai/promptBuilder.js` and `docs/PROMPT_BUILDING_GUIDE.md`.

---

## Testing

```bash
npm test              # Run all 150 tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report in terminal
npm run test:report   # Generate JSON report + coverage for Test Dashboard
```

The **Test Dashboard** is available at `/tests` in the running app. It shows pass/fail status for all suites and per-file line/branch coverage. To update it:

```bash
npm run test:report   # Writes to public/test-results.json + public/coverage/
```

Current coverage: **83% lines · 77% branches** across 11 source files.

---

## Scripts Reference

| Script | What it does |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 5174) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format all source files |
| `npm run format:check` | Check formatting without changing files |
| `npm test` | Run Vitest (all tests, single run) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run tests with terminal coverage report |
| `npm run test:report` | Generate JSON test results + coverage for `/tests` dashboard |

> **Note:** Use `npm install --legacy-peer-deps` when installing dependencies — some TipTap packages have peer dep conflicts that are safe to ignore.
