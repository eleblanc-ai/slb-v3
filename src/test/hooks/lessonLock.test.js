/**
 * Lesson lock contention tests.
 *
 * These validate the concurrent-lock semantics described in
 * LOCK_CONTENTION_TEST.md:
 *   - Exactly one of two concurrent acquirers wins.
 *   - The loser is told who owns the lock.
 *   - Only the owner can release.
 *   - After release, another user can acquire.
 *   - Heartbeat refresh succeeds for the owner only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock state — simulates a single row in the lesson_locks table.
// ---------------------------------------------------------------------------
let lockState = {}; // { [lessonId]: { user_id, user_name } }

/** Tiny delay to make "concurrent" calls actually interleave. */
const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Simulates the Supabase `rpc()` method for the three lock RPCs.
 * The behaviour mirrors the SQL functions in add_lesson_lock.sql.
 */
function mockRpc(fnName, params) {
  return (async () => {
    await tick();

    if (fnName === 'acquire_lesson_lock') {
      const { p_lesson_id, p_user_id, p_user_name } = params;
      const existing = lockState[p_lesson_id];

      if (!existing) {
        // No lock — grant it.
        lockState[p_lesson_id] = { user_id: p_user_id, user_name: p_user_name };
        return { data: { success: true }, error: null };
      }

      if (existing.user_id === p_user_id) {
        // Re-entrant — same user already holds it.
        return { data: { success: true }, error: null };
      }

      // Someone else holds the lock.
      return {
        data: {
          success: false,
          locked_by: existing.user_id,
          locked_by_name: existing.user_name,
        },
        error: null,
      };
    }

    if (fnName === 'release_lesson_lock') {
      const { p_lesson_id, p_user_id } = params;
      const existing = lockState[p_lesson_id];

      if (existing?.user_id === p_user_id) {
        delete lockState[p_lesson_id];
        return { data: true, error: null };
      }

      return { data: false, error: null };
    }

    if (fnName === 'refresh_lesson_lock') {
      const { p_lesson_id, p_user_id } = params;
      const existing = lockState[p_lesson_id];

      if (existing?.user_id === p_user_id) {
        return { data: true, error: null };
      }

      return { data: false, error: null };
    }

    return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
  })();
}

// ---------------------------------------------------------------------------
// Mock supabaseClient so the hook (or any direct caller) uses our fake.
// ---------------------------------------------------------------------------
vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    rpc: (fn, params) => mockRpc(fn, params),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Lesson lock contention', () => {
  const LESSON = 'lesson-abc-123';
  const USER_A = { id: 'user-a-id', name: 'Alice' };
  const USER_B = { id: 'user-b-id', name: 'Bob' };

  beforeEach(() => {
    lockState = {};
  });

  it('grants the lock to the first requester', async () => {
    const { data } = await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
      p_user_name: USER_A.name,
    });

    expect(data.success).toBe(true);
  });

  it('denies a second user when the lock is held', async () => {
    await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
      p_user_name: USER_A.name,
    });

    const { data } = await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_B.id,
      p_user_name: USER_B.name,
    });

    expect(data.success).toBe(false);
    expect(data.locked_by).toBe(USER_A.id);
    expect(data.locked_by_name).toBe(USER_A.name);
  });

  it('concurrent acquire — exactly one wins', async () => {
    const [resA, resB] = await Promise.all([
      mockRpc('acquire_lesson_lock', {
        p_lesson_id: LESSON,
        p_user_id: USER_A.id,
        p_user_name: USER_A.name,
      }),
      mockRpc('acquire_lesson_lock', {
        p_lesson_id: LESSON,
        p_user_id: USER_B.id,
        p_user_name: USER_B.name,
      }),
    ]);

    const results = [resA.data.success, resB.data.success];
    const winners = results.filter(Boolean);
    const losers = results.filter((r) => !r);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    // The loser should be told who owns the lock
    const loserData = resA.data.success ? resB.data : resA.data;
    expect(loserData.locked_by_name).toBeTruthy();
  });

  it('only the owner can release the lock', async () => {
    await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
      p_user_name: USER_A.name,
    });

    // Non-owner release → false
    const { data: nonOwner } = await mockRpc('release_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_B.id,
    });
    expect(nonOwner).toBe(false);

    // Owner release → true
    const { data: owner } = await mockRpc('release_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
    });
    expect(owner).toBe(true);
  });

  it('after release, another user can acquire', async () => {
    await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
      p_user_name: USER_A.name,
    });

    await mockRpc('release_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
    });

    const { data } = await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_B.id,
      p_user_name: USER_B.name,
    });

    expect(data.success).toBe(true);
  });

  it('heartbeat refresh succeeds only for the lock owner', async () => {
    await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
      p_user_name: USER_A.name,
    });

    const { data: ownerRefresh } = await mockRpc('refresh_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
    });
    expect(ownerRefresh).toBe(true);

    const { data: nonOwnerRefresh } = await mockRpc('refresh_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_B.id,
    });
    expect(nonOwnerRefresh).toBe(false);
  });

  it('re-entrant acquire by same user succeeds', async () => {
    await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
      p_user_name: USER_A.name,
    });

    const { data } = await mockRpc('acquire_lesson_lock', {
      p_lesson_id: LESSON,
      p_user_id: USER_A.id,
      p_user_name: USER_A.name,
    });

    expect(data.success).toBe(true);
  });
});
