import { Edit2, Trash2 } from 'lucide-react';

/**
 * SectionHeaderField - A display-only section header to visually break up form sections.
 */
export default function SectionHeaderField({ field, onEdit, onDelete }) {
  return (
    <div style={{
      padding: '0.5rem 0',
      borderBottom: '2px solid var(--gray-200)',
      position: 'relative',
    }}>
      {(onEdit || onDelete) && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0',
          display: 'flex',
          gap: '0.5rem',
          zIndex: 2
        }}>
          {onEdit && (
            <button
              onClick={() => onEdit(field)}
              style={{
                padding: '0.375rem',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              title="Edit field"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(field.id)}
              style={{
                padding: '0.375rem',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fee'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              title="Delete field"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: 'var(--gray-900)',
        margin: 0,
      }}>
        {field.name}
      </h2>
    </div>
  );
}
