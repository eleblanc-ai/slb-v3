import { createContext, useState, useCallback, useRef } from 'react';

export const ToastContext = createContext(null);

/**
 * Provides a toast notification system to the app.
 * Wrap your app (or Layout) with <ToastProvider> and use the useToast() hook.
 */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/* ─── Toast container (fixed position) ─── */

const TYPE_STYLES = {
  success: { bg: '#dcfce7', border: '#16a34a', icon: '✓', color: '#15803d' },
  error: { bg: '#fef2f2', border: '#ef4444', icon: '✗', color: '#dc2626' },
  warning: { bg: '#fefce8', border: '#eab308', icon: '⚠', color: '#ca8a04' },
  info: { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ', color: '#2563eb' },
};

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 100000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onClose={() => onRemove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ message, type, onClose }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.info;

  return (
    <div
      style={{
        pointerEvents: 'auto',
        padding: '0.75rem 1rem',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        maxWidth: '420px',
        animation: 'toastSlideIn 0.25s ease-out',
      }}
    >
      <span style={{ color: s.color, fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
        {s.icon}
      </span>
      <span style={{ flex: 1, color: '#1f2937', fontSize: '0.875rem', lineHeight: 1.4 }}>
        {message}
      </span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#9ca3af',
          fontSize: '1.1rem',
          padding: '0 0.25rem',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>

      {/* Keyframes injected inline */}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
