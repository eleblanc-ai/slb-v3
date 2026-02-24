import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';
import {
  modalOverlay,
  modalCard,
  modalHeading,
  modalHeaderRow,
  modalButtonRow,
  modalCloseButton,
  closeButtonHover,
  outlineButton,
  gradientButton,
  liftOnHover,
  warningBox,
  warningText,
  warningList,
} from '../../styles/shared';
import { useToast } from '../../hooks/useToast';

/**
 * Modal for exporting a lesson as markdown.
 * Shows missing required fields warning, markdown preview, download, and copy-to-clipboard.
 */
export default function ExportModal({
  markdown,
  missingRequiredFields,
  staleFields = [],
  templateName,
  fields,
  fieldValues,
  onClose,
}) {
  const toast = useToast();
  const contentIdField = fields.find(f => f.name === 'Content ID');
  const contentId = contentIdField ? fieldValues[contentIdField.id] : null;
  const filename = contentId ? `${contentId}.md` : `${templateName || 'lesson'}-export.md`;
  const hasMissing = missingRequiredFields.length > 0;
  const hasStale = staleFields.length > 0;

  const handleDownload = () => {
    if (hasMissing) return;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (hasMissing) return;
    navigator.clipboard.writeText(markdown);
    toast.success('Markdown copied to clipboard!');
  };

  const disabledOverrides = hasMissing
    ? { color: '#9ca3af', background: '#e5e7eb', cursor: 'not-allowed', boxShadow: 'none', opacity: 0.6 }
    : {};

  return createPortal(
    <div style={{ ...modalOverlay, padding: '2rem' }}>
      <div style={{
        ...modalCard,
        maxWidth: '900px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={modalHeaderRow}>
          <h2 style={modalHeading}>Export Lesson - Markdown</h2>
          <button onClick={onClose} style={modalCloseButton} {...closeButtonHover}>
            <X size={24} />
          </button>
        </div>

        {/* Missing Required Fields Warning */}
        {hasMissing && (
          <div style={warningBox}>
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

        {/* Stale Context Fields Warning */}
        {hasStale && (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
          }}>
            <p style={{
              color: '#92400e',
              fontWeight: 600,
              fontSize: '0.875rem',
              margin: '0 0 0.5rem 0',
            }}>
              The following fields have outdated context and may need to be regenerated:
            </p>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              color: '#b45309',
              fontSize: '0.875rem',
            }}>
              {staleFields.map((field, idx) => (
                <li key={field.id || idx}>
                  {field.name} <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>({field.section})</span>
                  <span style={{ color: '#d97706', fontSize: '0.75rem' }}> — changed: {field.changedContextNames.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <pre style={{
            margin: 0,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: 'var(--gray-800)'
          }}>
            {markdown}
          </pre>
        </div>

        <div style={modalButtonRow}>
          <button onClick={onClose} style={outlineButton}>Close</button>
          <button
            disabled={hasMissing}
            onClick={handleDownload}
            style={{
              ...gradientButton('#10b981', '#059669', '16, 185, 129'),
              ...disabledOverrides,
            }}
            {...(hasMissing ? {} : liftOnHover('16, 185, 129'))}
          >
            <Download size={16} />
            Download
          </button>
          <button
            disabled={hasMissing}
            onClick={handleCopy}
            style={{
              ...gradientButton('#6366f1', '#4f46e5', '99, 102, 241'),
              ...disabledOverrides,
            }}
            {...(hasMissing ? {} : liftOnHover('99, 102, 241'))}
          >
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
