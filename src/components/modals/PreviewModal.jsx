import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { marked } from 'marked';
import { sanitizeHTML } from '../../lib/sanitize';
import {
  modalOverlay,
  modalCard,
  modalHeading,
  modalCloseButton,
  closeButtonHover,
  gradientButton,
  liftOnHover,
  warningBox,
  warningText,
  warningList,
  coverImageContainer,
  coverImageFull,
  markdownBody,
  markdownPreviewCSS,
} from '../../styles/shared';

/**
 * Modal for previewing a lesson's rendered markdown output.
 * Shows missing required fields warning, cover image, and styled markdown.
 */
export default function PreviewModal({
  markdown,
  coverImage,
  missingRequiredFields,
  onClose,
}) {
  const hasMissing = missingRequiredFields.length > 0;

  return createPortal(
    <div style={{ ...modalOverlay, padding: '2rem' }}>
      <div style={{
        ...modalCard,
        maxWidth: '1000px',
        maxHeight: '90vh',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem 2rem',
          borderBottom: '1px solid var(--gray-200)'
        }}>
          <h2 style={modalHeading}>Lesson Preview</h2>
          <button onClick={onClose} style={modalCloseButton} {...closeButtonHover}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
          {/* Missing Required Fields Warning */}
          {hasMissing && (
            <div style={{ ...warningBox, marginBottom: '1.5rem' }}>
              <p style={warningText}>
                The following required fields must be filled out before exporting:
              </p>
              <ul style={warningList}>
                {missingRequiredFields.map((field, idx) => (
                  <li key={field.id || idx}>
                    {field.name} <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>({field.section})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cover Image */}
          {coverImage && (
            <div style={coverImageContainer}>
              <img src={coverImage} alt="Cover" style={coverImageFull} />
            </div>
          )}

          {/* Rendered Markdown */}
          <div
            className="markdown-preview"
            style={markdownBody}
            dangerouslySetInnerHTML={{
              __html: sanitizeHTML(marked.parse(markdown || '', { breaks: true, gfm: true }))
            }}
          />
          <style>{markdownPreviewCSS}</style>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid var(--gray-200)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={gradientButton('#8b5cf6', '#7c3aed', '139, 92, 246', { padding: '0.625rem 1.5rem' })}
            {...liftOnHover('139, 92, 246')}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
