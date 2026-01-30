import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import TipTapEditor from '../core/TipTapEditor';

export default function SetInitialLessonFieldsModal({ visible, onClose, onSave, fields = [], initialValues = {} }) {
  const [fieldValues, setFieldValues] = useState({});

  useEffect(() => {
    if (visible) {
      // Initialize with any provided initial values
      setFieldValues(initialValues);
    }
  }, [visible, initialValues]);

  if (!visible) return null;

  const handleSave = () => {
    // Validate required fields
    const missingFields = designerFields.filter(f => f.required && !fieldValues[f.id]);
    
    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.map(f => f.name).join(', ')}`);
      return;
    }
    
    onSave(fieldValues);
  };

  const handleCancel = () => {
    setFieldValues({});
    onClose();
  };

  // Filter only designer fields that are required for generation
  const designerFields = fields.filter(f => f.fieldFor === 'designer' && f.requiredForGeneration === true);
  
  console.log('🔍 Modal received fields:', fields);
  console.log('🔍 Filtered designer fields:', designerFields);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1400px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{
          padding: '2rem 2rem 1.5rem',
          borderBottom: '1px solid var(--gray-200)'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.875rem',
              fontWeight: 700,
              color: 'var(--gray-900)',
              margin: '0 0 0.5rem 0'
            }}>
              Set Initial Lesson Fields
            </h2>
            <p style={{
              fontSize: '1rem',
              color: 'var(--gray-600)',
              margin: 0,
              lineHeight: '1.5'
            }}>
              Provide initial values for your lesson's designer fields. You'll be able to edit and generate content with AI after this step.
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{
          padding: '2rem',
          overflowY: 'auto',
          flex: 1
        }}>
          {designerFields.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--gray-500)'
            }}>
              <p style={{ fontSize: '1.125rem', margin: 0 }}>
                No designer fields found in this template.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {designerFields.map(field => (
                <div key={field.id}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--gray-700)',
                    marginBottom: '0.5rem'
                  }}>
                    {field.name}
                    {field.required && <span style={{ color: '#ef4444' }}> *</span>}
                  </label>
                  {field.helperText && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--gray-500)',
                      margin: '0 0 0.5rem 0'
                    }}>
                      {field.helperText}
                    </p>
                  )}
                  {field.type === 'text' ? (
                    <input
                      type="text"
                      value={fieldValues[field.id] || ''}
                      onChange={(e) => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.placeholder || ''}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--gray-300)',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.outline = 'none';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--gray-300)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  ) : field.type === 'rich_text' ? (
                    <div style={{
                      height: '800px',
                      resize: 'vertical',
                      overflow: 'auto',
                      minHeight: '200px'
                    }}>
                      <TipTapEditor
                        content={fieldValues[field.id] || ''}
                        onChange={(html) => setFieldValues(prev => ({ ...prev, [field.id]: html }))}
                        placeholder={field.placeholder || 'Enter text...'}
                      />
                    </div>
                  ) : field.type === 'grade_band_selector' || field.type === 'theme_selector' || field.type === 'dropdown' ? (
                    <select
                      value={fieldValues[field.id] || ''}
                      onChange={(e) => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--gray-300)',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.outline = 'none';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--gray-300)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <option value="">Select an option...</option>
                      {field.options?.map(option => (
                        <option key={option.value || option} value={option.value || option}>
                          {option.label || option}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '0.625rem 1.5rem',
              border: '1px solid var(--gray-300)',
              borderRadius: '8px',
              backgroundColor: '#fff',
              color: 'var(--gray-700)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--gray-50)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff';
            }}
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '0.625rem 1.5rem',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
