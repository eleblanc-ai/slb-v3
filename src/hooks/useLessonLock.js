import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Custom hook for managing lesson lock lifecycle:
 * - Acquire lock on mount/lesson change
 * - Heartbeat every 30s to keep lock alive
 * - Release on unmount and beforeunload
 *
 * @param {string|null} lessonId - The lesson to lock
 * @param {Object|null} session - Supabase session (needs user.id)
 * @param {Object|null} profile - User profile (needs display_name)
 * @returns {{ isLessonLocked, lockOwnerName, acquireLessonLock, releaseLessonLock }}
 */
export default function useLessonLock(lessonId, session, profile) {
  const [isLessonLocked, setIsLessonLocked] = useState(false);
  const [lockOwner, setLockOwner] = useState(null);
  const [lockOwnerName, setLockOwnerName] = useState('');
  const lockHeartbeatRef = useRef(null);

  const refreshLessonLock = useCallback(async (lessonIdToRefresh) => {
    if (!lessonIdToRefresh || !session?.user?.id) return;

    try {
      const { data, error } = await supabase.rpc('refresh_lesson_lock', {
        p_lesson_id: lessonIdToRefresh,
        p_user_id: session.user.id,
      });
      console.log('🔄 Lock heartbeat:', new Date().toLocaleTimeString(), data ? '✅' : '❌');
    } catch (err) {
      console.error('Error refreshing lock:', err);
    }
  }, [session?.user?.id]);

  const acquireLessonLock = useCallback(async (lessonIdToLock) => {
    if (!lessonIdToLock || !session?.user?.id) return { success: false };

    const userName = profile?.display_name || session?.user?.email || 'Unknown User';

    try {
      const { data, error } = await supabase.rpc('acquire_lesson_lock', {
        p_lesson_id: lessonIdToLock,
        p_user_id: session.user.id,
        p_user_name: userName,
      });

      if (error) {
        console.error('Error acquiring lock:', error);
        return { success: false };
      }

      if (data?.success) {
        setIsLessonLocked(false);
        setLockOwner(null);
        setLockOwnerName('');

        // Start heartbeat to keep lock alive
        if (lockHeartbeatRef.current) {
          clearInterval(lockHeartbeatRef.current);
        }
        lockHeartbeatRef.current = setInterval(() => {
          refreshLessonLock(lessonIdToLock);
        }, 30000);

        return { success: true };
      } else {
        setIsLessonLocked(true);
        setLockOwner(data?.locked_by);
        setLockOwnerName(data?.locked_by_name || 'Another user');
        return { success: false, lockedBy: data?.locked_by_name };
      }
    } catch (err) {
      console.error('Error in acquireLessonLock:', err);
      return { success: false };
    }
  }, [session?.user?.id, profile?.display_name, session?.user?.email, refreshLessonLock]);

  const releaseLessonLock = useCallback(async (lessonIdToRelease) => {
    if (!lessonIdToRelease || !session?.user?.id) return;

    if (lockHeartbeatRef.current) {
      clearInterval(lockHeartbeatRef.current);
      lockHeartbeatRef.current = null;
    }

    try {
      await supabase.rpc('release_lesson_lock', {
        p_lesson_id: lessonIdToRelease,
        p_user_id: session.user.id,
      });
    } catch (err) {
      console.error('Error releasing lock:', err);
    }
  }, [session?.user?.id]);

  const forceReleaseLock = useCallback(async (lessonIdToRelease) => {
    if (!lessonIdToRelease) return;

    if (lockHeartbeatRef.current) {
      clearInterval(lockHeartbeatRef.current);
      lockHeartbeatRef.current = null;
    }

    try {
      const { error } = await supabase
        .from('lessons')
        .update({ locked_by: null, locked_by_name: null, locked_at: null })
        .eq('id', lessonIdToRelease);
      if (error) throw error;

      setIsLessonLocked(false);
      setLockOwner(null);
      setLockOwnerName('');
    } catch (err) {
      console.error('Error force-releasing lock:', err);
    }
  }, []);

  // Release lock on unmount and beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (lessonId && session?.user?.id) {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/release_lesson_lock?apikey=${encodeURIComponent(anonKey)}`;

        try {
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ p_lesson_id: lessonId, p_user_id: session.user.id }),
            keepalive: true,
          });
        } catch (err) {
          // Last resort: try sendBeacon
          try {
            const body = new Blob(
              [JSON.stringify({ p_lesson_id: lessonId, p_user_id: session.user.id })],
              { type: 'application/json' }
            );
            navigator.sendBeacon?.(url, body);
          } catch (_) { /* ignore */ }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (lessonId && session?.user?.id) {
        releaseLessonLock(lessonId);
      }
      if (lockHeartbeatRef.current) {
        clearInterval(lockHeartbeatRef.current);
      }
    };
  }, [lessonId, session?.user?.id, releaseLessonLock]);

  return {
    isLessonLocked,
    lockOwner,
    lockOwnerName,
    acquireLessonLock,
    releaseLessonLock,
    forceReleaseLock,
    refreshLessonLock,
  };
}
