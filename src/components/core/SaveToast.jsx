import { Check } from 'lucide-react';

/**
 * Fixed-position toast notification that auto-dismisses.
 *
 * Props:
 *  - visible   – whether to show
 *  - message   – text to display
 */
export default function SaveToast({ visible, message }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '5rem',
        right: '2rem',
        background: 'linear-gradient(135deg, #ecfeff 0%, #eef2ff 100%)',
        color: '#1e293b',
        border: '1px solid #c7d2fe',
        padding: '1rem 1.5rem',
        borderRadius: '8px',
        boxShadow: '0 12px 30px rgba(30, 41, 59, 0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '1rem',
        fontWeight: 600,
        zIndex: 9999,
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <Check size={20} />
      {message}
    </div>
  );
}
