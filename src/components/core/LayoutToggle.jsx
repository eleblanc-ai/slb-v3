import { Rows3, Columns2 } from 'lucide-react';

/**
 * Stacked / side-by-side layout toggle pill.
 *
 * Props:
 *  - layoutMode    – 'stacked' | 'side-by-side'
 *  - onModeChange  – (mode) => void
 */
export default function LayoutToggle({ layoutMode, onModeChange }) {
  const btnStyle = (mode) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.625rem',
    border: 'none',
    borderRadius: '6px',
    background: layoutMode === mode ? '#fff' : 'transparent',
    color: layoutMode === mode ? 'var(--primary)' : 'var(--gray-500)',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: layoutMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-500)' }}>Layout</span>
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--gray-100)',
          borderRadius: '8px',
          padding: '3px',
        }}
      >
        <button
          onClick={() => onModeChange('stacked')}
          style={btnStyle('stacked')}
          title="Stack fields vertically"
        >
          <Rows3 size={14} />
        </button>
        <button
          onClick={() => onModeChange('side-by-side')}
          style={btnStyle('side-by-side')}
          title="Show fields side by side"
        >
          <Columns2 size={14} />
        </button>
      </div>
    </div>
  );
}
