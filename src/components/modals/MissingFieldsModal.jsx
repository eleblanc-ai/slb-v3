import React from 'react';
import { AlertCircle } from 'lucide-react';
import { APP_CONFIG } from '../../config';

export default function MissingFieldsModal({ 
  visible,
  onClose,
  missingFields = []
}) {
  if (!visible) return null;

  return (
    <div style={{
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
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle size={24} style={{ color: '#f59e0b' }} />
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--gray-900)',
            margin: 0
          }}>
            Missing Required Fields
          </h2>
        </div>

        {/* Content */}
        <div style={{ 
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1
        }}>
          <p style={{
            color: 'var(--gray-600)',
            fontSize: '1rem',
            marginBottom: '1.5rem',
            lineHeight: '1.5'
          }}>
            The following fields need to be filled in before AI generation can continue:
          </p>
          
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {missingFields.map((field, index) => (
                <li key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#92400e',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b'
                  }} />
                  <span>
                    <strong>{field.name}</strong>
                    {field.section && <span style={{ color: '#78350f' }}> ({field.section})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p style={{
            color: 'var(--gray-600)',
            fontSize: '0.875rem',
            marginTop: '1rem',
            lineHeight: '1.5',
            fontStyle: 'italic'
          }}>
            These fields have been highlighted in red. Please fill them in and click "Continue Generating Lesson" to resume.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid var(--gray-200)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#5b21b6';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary)';
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
