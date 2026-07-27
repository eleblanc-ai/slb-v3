# Server-Side AI Proxy

**Date:** 2026-07-27
**Status:** Approved, not yet implemented

## Problem

`src/services/aiClient.js` constructs Anthropic, OpenAI, and Google SDK clients in the
browser using `import.meta.env.VITE_*` keys with `dangerouslyAllowBrowser: true`. Vite
inlines every `VITE_`-prefixed variable into the bundle as a literal string at build
time, so all three provider keys shipped in plaintext JavaScript to every visitor of
`smart-lesson-builder.vercel.app`.

This was confirmed, not inferred: the production bundle served at
`/assets/index-CFyptNDV.js` contained a live `sk-ant-api03-` key and a live `sk-proj-`
key, readable over an unauthenticated `curl`.

Rotating keys does not fix this. A new key placed in a `VITE_` variable is inlined into
the next build and becomes public again. The architecture re-leaks on every deploy.

### Already completed

- All exposed provider keys revoked at Anthropic, OpenAI, and Google.
- `VITE_ANTHROPIC_API_KEY`, `VITE_OPENAI_API_KEY`, and `VITE_GOOGLE_API_KEY` deleted
  from Vercel across all environments.

`SUPABASE_SERVICE_ROLE_KEY` was never exposed — it carries no `VITE_` prefix and was
verified absent from the bundle. `VITE_SUPABASE_ANON_KEY` is public by design and stays.

## Goal

Move all provider keys server-side so no build can place them in the browser, while
keeping the application's behavior unchanged.

## Non-goals

- Streaming responses. Nothing in the app streams today.
- Rate limiting or per-user quotas.
- Moving Supabase Storage uploads server-side. Measured image sizes make this
  unnecessary (see Image Handling).
- Refactoring `batchLessonEngine`, `CreateNewLesson.jsx`, or `CreateNewLessonType.jsx`
  beyond what the contract requires — which is nothing.

## Architecture

A single Vercel serverless function, `api/ai.js`, accepts POST requests and dispatches
on an `action` field. It reads provider keys from `process.env` using unprefixed names,
which Vite cannot inline.

`src/services/aiClient.js` keeps its five exports with identical signatures and return
shapes. Each body becomes a `fetch('/api/ai', …)` call. Because the contract is
unchanged, all 17 call sites across the three consuming modules stay as they are.

### Endpoint contract

| action | request fields | response |
|---|---|---|
| `generate` | `prompt`, `model`, `maxTokens` | `{ text }` |
| `function` | `prompt`, `model`, `functionSchema` | `{ result }` |
| `image` | `prompt` | `{ url, model, altText }` — `url` is a base64 data URL |
| `altText` | `imageDataUrl` | `{ text }` |
| `summarize` | `passage`, `maxChars` | `{ summary }` — may be `null` |

`generateImage(prompt, size)` keeps its two-parameter signature so call sites need no
edit, but `size` is now ignored and not sent to the server: it only ever configured the
DALL-E fallback, which is being removed. Gemini's output dimensions are fixed by the
model.

### Authentication

The client attaches its existing Supabase access token as `Authorization: Bearer <jwt>`.
The function verifies it with `createClient(url, anonKey).auth.getUser(token)` and
returns 401 before contacting any provider if verification fails.

No new secrets are required. Vercel exposes all project environment variables to
serverless functions through `process.env`, including the `VITE_`-prefixed Supabase
values, so `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are readable server-side.

Without this gate the endpoint is an open relay: the keys stop being *published*, but
anyone who finds the URL can still spend the quota.

### Model allowlist

```js
const TEXT_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5'];
```

`generate` and `function` accept only these two, checked after `normalizeModelId`
resolves the legacy aliases `claude-sonnet-4-20250514` and `claude-sonnet-4-6`. Any
other value returns 400. This matches `ModelSelector.jsx`, which already offers only
these two models; the allowlist enforces server-side what the UI merely presents, so a
hand-crafted request cannot select an arbitrary model.

`altText` (`gpt-4o`) and `summarize` (`gpt-3.5-turbo`) hardcode their models. The
caller cannot influence them.

### Provider scope

OpenAI is not user-selectable. It retains exactly two background roles: `gpt-4o` for
alt text when Gemini returns an image without a text part, and `gpt-3.5-turbo` for the
passage summaries that guide image prompts. Both preserve current behavior — alt text
in particular is an accessibility requirement for lesson content.

The DALL-E 3 fallback is removed. Images come from Gemini only; if Gemini fails the
request errors rather than silently switching providers.

## Image handling

Today the browser receives a base64 data URL, optionally sends it to OpenAI for alt
text, then converts it to a blob and uploads it to the `lesson-images` bucket. Routing
this through Vercel imposes a 4.5 MB cap on request and response bodies.

Measurement of 94 existing generated images in the bucket: median 0.78 MB, largest
2.27 MB. Base64 inflates the largest to roughly 3.11 MB, which fits under the cap with
headroom. Server-side uploading is therefore unnecessary.

Only the first hop changes. Alt-text orchestration and the storage upload remain
client-side and untouched.

## Error handling

| condition | status | client behavior |
|---|---|---|
| missing or invalid JWT | 401 | throws `Error` |
| unknown action, missing field, disallowed model | 400 | throws `Error` |
| provider call failed | 502 | throws `Error` with the provider's message |

Provider messages are forwarded so failures stay debuggable, but the API key is never
included in a response body or log line.

The client throws standard `Error` objects, so the existing `withRetry` wrapper in
`batchLessonEngine.js` continues to work without modification.

`summarizePassageForImage` keeps returning `null` on failure rather than throwing,
because its callers treat a missing summary as an acceptable degraded state.

## Configuration changes

- `vercel.json`: add `functions: { "api/ai.js": { "maxDuration": 60 } }`. Image
  generation is the long pole. Gemini's existing retry behavior moves to the server
  unchanged — up to 3 attempts with backoff capped at 10s — which fits inside 60s.
- `package.json`: `dev` script becomes `vercel dev`, which serves the Vite app and the
  functions together. Plain `vite` cannot serve `/api`.
- Vercel environment: add `ANTHROPIC_API_KEY` and `GOOGLE_API_KEY`; update
  `OPENAI_API_KEY` to a fresh value. All unprefixed.
- Local `.env`: replace the three `VITE_`-prefixed provider keys with unprefixed names.

## Testing

`src/test/lib/aiClient.test.js` currently mocks `@anthropic-ai/sdk` and `openai`
directly. Once `aiClient` communicates over HTTP those mocks target code that is no
longer called, so the file is rewritten to mock global `fetch`.

Retained cases: Claude model routing, tool-use extraction for `callAIWithFunction`,
error propagation from a failed call.

New cases: a disallowed model returns 400 and surfaces as a thrown error; a 401
surfaces as a thrown error; `summarizePassageForImage` returns `null` rather than
throwing when the call fails.

## Deployment note

There is no partial state. Once deployed, the browser holds no keys and the function
requires them, so generation is broken until `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and
`GOOGLE_API_KEY` are present in Vercel. Set them before or immediately after the deploy.

## Follow-up, out of scope

`node_modules` is committed to this public repository (11,076 files tracked). Unrelated
to this work, but worth addressing separately.
