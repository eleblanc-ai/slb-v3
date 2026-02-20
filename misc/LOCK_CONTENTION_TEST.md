# Lock Contention Test — Explainer

## Purpose
Validate that simultaneous lock acquisition on a lesson allows only one editor to obtain the lock, and that the loser is reported as locked.

## Environment
- Environment: Production
- Date: 2026-02-18
- Lesson ID: 0d3fe67b-3581-4f3f-b2e4-aac680d28c4f

## Setup
- Two distinct user accounts (credentials not recorded here).
- Supabase RPCs used:
  - `acquire_lesson_lock(p_lesson_id, p_user_id, p_user_name)`
  - `release_lesson_lock(p_lesson_id, p_user_id)`

## Method
1. Signed in two separate users to obtain `user_id` values.
2. Fired two `acquire_lesson_lock` RPC calls concurrently (same lesson ID).
3. Captured both responses (success flag, locked_by_name, latency).
4. Released the lock from whichever user acquired it.

## Expected Behavior
- Exactly one user returns `success: true`.
- The other returns `success: false` with `locked_by_name` populated.
- Only the lock owner can release the lock; the other release attempt returns `false`.

## Observed Results
- UserA: `success: true`, lock acquired.
- UserB: `success: false`, `locked_by_name` present.
- Release:
  - UserA: released `true`.
  - UserB: released `false`.

## Conclusion
Lock contention behaved correctly: only one concurrent requester obtained the lock, the other was denied, and only the owner could release it.

## Notes
- This test used concurrent calls to reduce timing bias.
- No credential values are stored in this document.
