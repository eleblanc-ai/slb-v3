/**
 * PromptPreviewPanel — Read-only monospace view of the assembled prompt.
 */
export default function PromptPreviewPanel({ promptPreview }) {
  return (
    <div
      style={{
        width: '100%',
        padding: '2rem',
        overflowY: 'auto',
        background: '#fafafa',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          width: '100%',
          background: '#fff',
          border: '2px solid var(--gray-200)',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'var(--gray-700)',
            marginBottom: '1.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            paddingBottom: '1rem',
            borderBottom: '2px solid var(--gray-200)',
          }}
        >
          Full Prompt Preview
        </div>
        <div
          style={{
            fontSize: '0.875rem',
            fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'pre-wrap',
            color: 'var(--gray-700)',
            lineHeight: '1.8',
            background: 'var(--gray-50)',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid var(--gray-200)',
          }}
        >
          {promptPreview}
        </div>
      </div>
    </div>
  );
}
