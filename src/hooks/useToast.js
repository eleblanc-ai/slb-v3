import { useContext } from 'react';
import { ToastContext } from '../components/core/ToastProvider';

/**
 * Hook to show toast notifications.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.warning('Careful…');
 *   toast.info('FYI…');
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return context;
}
