# Changes — `fix/image-gen-and-react-hooks`

Bug fixes for image generation, React Hooks compliance, and a test-harness gap.

**Result:** all tests pass (`155/155`, was `153/155`); ESLint errors on the changed files drop to `0`.

---

## 1. 🔴 DALL-E image fallback returned the wrong format

**File:** `src/services/aiClient.js` (`generateWithDallE`)

When Gemini image generation fails, the app falls back to DALL-E 3. The fallback
returned a **remote OpenAI URL**, but every caller expects a **base64 data URL**:

- `src/components/pages/CreateNewLesson.jsx` and `src/services/batchLessonEngine.js`
  do `imageDataUrl.split(',')[1]` + `atob()` to build a Blob and upload it to
  Supabase Storage. A remote URL has no `,`-separated base64 payload, so `atob()`
  throws and image generation fails whenever the DALL-E path is hit.
- Gemini already returns `data:<mime>;base64,<...>`, so the two providers were
  producing incompatible outputs.
- OpenAI image URLs also expire (~1 hour), so even if stored raw they would break.

**Fix:** request `response_format: 'b64_json'` and return
`data:image/png;base64,${response.data[0].b64_json}`, matching Gemini's contract.

## 2. 🔴 React Hooks rule violation

**File:** `src/components/modals/PreFormModal.jsx`

`if (!visible) return null;` ran **before** the `useState`/`useRef` calls, so the
hooks were called conditionally. When the modal toggles visibility, React's hook
order changes and the component crashes ("rendered fewer hooks than expected").

**Fix:** moved the `!visible` early return **below** all hook calls.

## 3. 🟡 Unsafe optional chaining on null query data

**File:** `src/components/pages/BrowseLessons.jsx`

`[...lessonsData?.map(...)]` throws `TypeError: undefined is not iterable` if the
Supabase query returns `null`, white-screening the Browse Lessons page.

**Fix:** normalize once with `const lessons = lessonsData || [];` before spreading.

## 4. Test-harness fix (not a product bug)

**File:** `src/test/lib/aiClient.test.js`

The "Gemini-first" test depends on `import.meta.env.VITE_GOOGLE_API_KEY`, which
Vitest does not load from `.env`, so the Gemini path was skipped and the test
failed non-deterministically.

**Fix:** stub the key with `vi.stubEnv('VITE_GOOGLE_API_KEY', ...)` in
`beforeEach` and clear it with `vi.unstubAllEnvs()` in `afterEach`.

---

## Files changed

| File | Change |
| --- | --- |
| `src/services/aiClient.js` | DALL-E fallback returns a base64 data URL |
| `src/components/modals/PreFormModal.jsx` | `!visible` guard moved below hooks |
| `src/components/pages/BrowseLessons.jsx` | guard null query data before spreading |
| `src/test/lib/aiClient.test.js` | stub `VITE_GOOGLE_API_KEY` for deterministic tests |

## Verify

```bash
npm test        # 155 passed
npm run lint    # 0 errors in the files above
```
