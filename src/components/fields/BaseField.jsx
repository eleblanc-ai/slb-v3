import { useState } from 'react';
import { Edit2, Trash2, ChevronDown, Sparkles, Settings, AlertTriangle } from 'lucide-react';
import { sanitizeHTML } from '../../lib/sanitize';

/**
 * BaseField - Parent component for all field types
 * Handles common field functionality: title, type badge, required/AI badges, edit/delete actions, helper text
 * Also handles AI generation controls when field is AI-enabled
 */
export default function BaseField({ 
  field, 
  onEdit, 
  onDelete,
  onGenerateAI,
  onAIConfig,
  isGenerating = false,
  hasGenerated = false,
  isMissing = false,
  staleContextNames = [],
  customGenerateLabel,
  hideRequiredAsterisk = false,
  children 
}) {
  const isStale = staleContextNames.length > 0;
  const [isHelperTextOpen, setIsHelperTextOpen] = useState(false);
  const getTypeLabel = (type) => {
    const typeLabels = {
      text: 'Text Field',
      rich_text: 'Rich Text',
      grade_band_selector: 'Grade Band',
      theme_selector: 'Theme',
      dropdown: 'Dropdown',
      checklist: 'Checklist',
      image: 'Image',
      assign_standards: 'Assign Standards'
    };
    return typeLabels[type] || type;
  };

  return (
    <div
      style={{
        padding: '1.5rem',
        border: isMissing ? '2px solid #ef4444' : isStale ? '2px solid #fbbf24' : '2px solid var(--gray-200)',
        borderRadius: '12px',
        backgroundColor: isMissing ? '#fef2f2' : isStale ? '#fffdf5' : '#fff',
        transition: 'all 0.2s',
        position: 'relative',
        boxShadow: isMissing ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : isStale ? '0 0 0 3px rgba(251, 191, 36, 0.1)' : 'none'
      }}
    >
      {/* Action Buttons - top right, absolute - only show in template editing mode */}
      {(onEdit || onDelete) && (
        <div style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          display: 'flex',
          gap: '0.5rem',
          zIndex: 2
        }}>
          {/* Edit Button */}
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
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#eff6ff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Edit field"
            >
              <Edit2 size={16} />
            </button>
          )}
          {/* Delete Button */}
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
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#fee';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Delete field"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
      {/* Main content, now full width */}
      <div>
          {/* Field Header: Name and Badges */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--gray-900)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              {field.name}
              {field.required && !hideRequiredAsterisk && (
                <span style={{ color: '#ef4444' }}>*</span>
              )}
            </h3>
            
            {/* AI-Enabled Badge */}
            {field.aiEnabled && (
              <span style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#f0fdf4',
                color: '#16a34a',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                AI-Enabled
              </span>
            )}
            
            {/* Required Badge (for fields marked as required for generation) */}
            {field.requiredForGeneration && (
              <span style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Sparkles size={12} />
                Required for AI Generation
              </span>
            )}
            
            {/* Stale / Outdated Badge with tooltip */}
            {isStale && (
              <span
                title={`Changed: ${staleContextNames.join(', ')}`}
                style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  border: '1px solid #fde68a',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'default'
                }}>
                <AlertTriangle size={12} />
                Context Changed
              </span>
            )}
          </div>
          
          {/* Helper Text Accordion */}
          {field.helperText && (
            <div style={{ marginBottom: '0.75rem', marginTop: '0rem' }}>
              <button
                onClick={() => setIsHelperTextOpen(!isHelperTextOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--primary)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ChevronDown 
                  size={16} 
                  style={{
                    transform: isHelperTextOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}
                />
                How do I use this field?
              </button>
              
              {isHelperTextOpen && (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--gray-700)',
                    padding: '0.75rem',
                    backgroundColor: 'var(--gray-50)',
                    borderRadius: '8px',
                    marginTop: '0.5rem',
                    lineHeight: '1.6'
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(field.helperText) }}
                />
              )}
            </div>
          )}
          
          {/* Custom field-specific content - wrapped with generating overlay */}
          <div style={{ position: 'relative' }}>
            {children}
            
            {/* Generating Overlay */}
            {isGenerating && (
              <>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(102, 126, 234, 0.05)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(1px)',
                  zIndex: 9,
                  pointerEvents: 'none'
                }} />
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}>
                    <Sparkles 
                      size={16} 
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                    Generating...
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
      {/* Action buttons moved above, so nothing here */}
      
      {/* AI Controls - Only show if field is AI-enabled */}
      {field.aiEnabled && (onGenerateAI || onAIConfig) && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--gray-200)'
        }}>
          {/* AI Config Button */}
          {onAIConfig && (
            <button
              onClick={() => onAIConfig(field)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--gray-300)',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: 'var(--gray-700)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                e.currentTarget.style.borderColor = 'var(--gray-400)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
                e.currentTarget.style.borderColor = 'var(--gray-300)';
              }}
              title="Configure AI generation settings"
            >
              <Settings size={14} />
              AI Config
            </button>
          )}
          
          {/* Generate Button */}
          {onGenerateAI && (
            <button
              onClick={() => onGenerateAI(field)}
              disabled={isGenerating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.875rem',
                border: 'none',
                borderRadius: '8px',
                background: isGenerating 
                  ? 'var(--gray-300)' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: isGenerating ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.3)',
                opacity: isGenerating ? 0.7 : 1
              }}
              onMouseOver={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                }
              }}
              onMouseOut={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
                }
              }}
              title={customGenerateLabel || (hasGenerated ? 'Regenerate with AI' : 'Generate with AI')}
            >
              <Sparkles size={14} />
              {customGenerateLabel || (isGenerating ? 'Generating...' : (hasGenerated ? 'Regenerate' : 'Generate'))}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
