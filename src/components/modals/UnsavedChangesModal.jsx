import { createPortal } from 'react-dom';
import {
  modalOverlay,
  modalCard,
  modalButtonRow,
  outlineButton,
  dangerOutlineButton,
  gradientButton,
  liftOnHover,
} from '../../styles/shared';

/**
 * Modal for confirming navigation when there are unsaved changes.
 */
export default function UnsavedChangesModal({ onCancel, onDiscard, onSave }) {
  return createPortal(
    <div style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: '500px' }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--gray-900)',
          marginBottom: '1rem'
        }}>
          Unsaved Changes
        </h2>
        <p style={{
          fontSize: '1rem',
          color: 'var(--gray-700)',
          marginBottom: '2rem',
          lineHeight: 1.6
        }}>
          You have unsaved changes. Would you like to save your lesson before leaving?
        </p>
        <div style={modalButtonRow}>
          <button onClick={onCancel} style={outlineButton}>
            Cancel
          </button>
          <button onClick={onDiscard} style={dangerOutlineButton}>
            Discard Changes
          </button>
          <button
            onClick={onSave}
            style={gradientButton('#667eea', '#764ba2', '102, 126, 234')}
            {...liftOnHover('102, 126, 234')}
          >
            Save &amp; Leave
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
