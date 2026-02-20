/**
 * ContextFieldsPanel — Right sidebar showing context field selections.
 * In template mode: interactive checkboxes.
 * In lesson mode: read-only list of pre-selected fields.
 */
export default function ContextFieldsPanel({
  mode,
  allFields,
  selectedFields,
  onToggleField,
  allowSelfContext,
  currentFieldId,
}) {
  const designerFields = allFields.filter(
    (f) => f.fieldFor === 'designer' && (allowSelfContext || f.id !== currentFieldId)
  );
  const builderFields = allFields.filter(
    (f) => f.fieldFor === 'builder' && (allowSelfContext || f.id !== currentFieldId)
  );

  const isLessonMode = mode === 'lesson';

  // In lesson mode, only show if there are selected fields
  if (isLessonMode && selectedFields.length === 0) return null;
  // In template mode, always show
  if (!isLessonMode && mode !== 'template') return null;

  const selectedDesigner = isLessonMode
    ? designerFields.filter((f) => selectedFields.includes(f.id))
    : designerFields;
  const selectedBuilder = isLessonMode
    ? builderFields.filter((f) => selectedFields.includes(f.id))
    : builderFields;

  return (
    <div
      style={{
        width: '35%',
        padding: '1.5rem',
        overflowY: 'auto',
        background: '#fafafa',
        borderLeft: '1px solid var(--gray-200)',
        minHeight: 0,
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '1.25rem',
          borderRadius: '12px',
          border: isLessonMode ? '2px solid #fbbf24' : '2px solid var(--gray-200)',
        }}
      >
        <label
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--gray-900)',
            display: 'block',
            marginBottom: '0.5rem',
          }}
        >
          Context Fields{isLessonMode ? ' (Set by Template)' : ''}
        </label>

        {isLessonMode && (
          <p
            style={{
              fontSize: '0.75rem',
              color: '#92400e',
              marginBottom: '0.75rem',
              lineHeight: 1.5,
            }}
          >
            These fields are used as context for AI generation. They were configured by the
            template designer.
          </p>
        )}

        {/* Designer section */}
        <FieldGroup
          label="DESIGNER"
          color="#059669"
          borderColor="#10b981"
          bgColor="#f0fdf4"
          selectedBg="#d1fae5"
          fields={selectedDesigner}
          selectedFields={selectedFields}
          interactive={!isLessonMode}
          onToggle={onToggleField}
        />

        {/* Builder section */}
        <FieldGroup
          label="BUILDER"
          color="#7c3aed"
          borderColor="#7c3aed"
          bgColor="#faf5ff"
          selectedBg="#ede9fe"
          fields={selectedBuilder}
          selectedFields={selectedFields}
          interactive={!isLessonMode}
          onToggle={onToggleField}
          style={{ marginTop: '1rem' }}
        />

        {!isLessonMode && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--gray-600)',
              marginTop: '0.75rem',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Shared designer / builder section ─── */

function FieldGroup({
  label,
  color,
  borderColor,
  bgColor,
  selectedBg,
  fields,
  selectedFields,
  interactive,
  onToggle,
  style = {},
}) {
  return (
    <div style={{ marginBottom: '1rem', ...style }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color, marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div
        style={{
          border: `2px solid ${borderColor}`,
          borderRadius: '8px',
          background: bgColor,
          padding: '0.75rem',
        }}
      >
        {fields.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem', margin: 0 }}>
            No {label.toLowerCase()} fields
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {fields.map((f) =>
              interactive ? (
                <label
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.625rem',
                    background: selectedFields.includes(f.id) ? selectedBg : '#fff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.id)}
                    onChange={() => onToggle(f.id)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <span>{f.name}</span>
                </label>
              ) : (
                <div
                  key={f.id}
                  style={{
                    padding: '0.625rem',
                    background: selectedBg,
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}
                >
                  {f.name}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
