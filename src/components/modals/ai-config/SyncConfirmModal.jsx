import { X } from 'lucide-react';
import { APP_CONFIG } from '../../../config';

/**
 * SyncConfirmModal — Nested confirmation dialog for syncing AI config from template.
 */
export default function SyncConfirmModal({
  visible,
  fieldName,
  syncing,
  onSync,
  onCancel,
  onDownloadBackup,
}) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: `blur(${APP_CONFIG.modals.backdropBlur})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          maxWidth: '520px',
          width: '100%',
          boxShadow:
            '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--gray-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--gray-900)',
              margin: 0,
            }}
          >
            Sync AI Config from Template
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--gray-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          <p
            style={{
              color: 'var(--gray-600)',
              fontSize: '0.95rem',
              marginBottom: '1rem',
              lineHeight: 1.5,
            }}
          >
            This will overwrite the current lesson AI settings for{' '}
            <strong>{fieldName}</strong> with the latest template configuration.
          </p>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--gray-200)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--gray-700)',
                marginBottom: '0.5rem',
                fontWeight: 600,
              }}
            >
              Want a backup first?
            </div>
            <button
              onClick={onDownloadBackup}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--gray-800)',
                background: '#fff',
                border: '1px solid var(--gray-300)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Download current config
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              disabled={syncing}
              style={{
                padding: '0.6rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--gray-700)',
                background: '#fff',
                border: '1px solid var(--gray-300)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSync}
              disabled={syncing}
              style={{
                padding: '0.6rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#fff',
                background: syncing ? '#93c5fd' : '#2563eb',
                border: 'none',
                borderRadius: '8px',
                cursor: syncing ? 'not-allowed' : 'pointer',
              }}
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
