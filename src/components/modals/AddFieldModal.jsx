import { useState, useEffect } from 'react';
import { X, Type, FileText, ChevronRight, ListOrdered, CheckSquare, Image, BookOpen, HelpCircle } from 'lucide-react';
import TipTapEditor from '../core/TipTapEditor';
import { APP_CONFIG } from '../../config';
import gradeRangeConfig from '../../config/gradeRangeOptions.json';
import themeSelectorConfig from '../../config/themeSelectorOptions.json';

const fieldTypes = [
  {
    type: 'text',
    label: 'Text Field',
    description: 'Single line or paragraph text input',
    icon: Type,
  },
  {
    type: 'rich_text',
    label: 'Rich Text',
    description: 'Formatted text with styling options',
    icon: FileText,
  },
  {
    type: 'grade_band_selector',
    label: 'Grade Band Selector',
    description: 'Dropdown to select grade level',
    icon: ListOrdered,
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    description: 'Dropdown with custom options',
    icon: ListOrdered,
  },
  {
    type: 'checklist',
    label: 'Checklist',
    description: 'Multiple checkbox options',
    icon: CheckSquare,
  },
  {
    type: 'image',
    label: 'Image Field',
    description: 'AI-generated image with description and alt text',
    icon: Image,
  },
  {
    type: 'theme_selector',
    label: 'Theme Selector',
    description: 'Dropdown to select lesson theme',
    icon: ListOrdered,
  },
  {
    type: 'assign_standards',
    label: 'Assign Standards',
    description: 'Search and assign educational standards',
    icon: BookOpen,
  },
  {
    type: 'mcqs',
    label: 'MCQs (AI)',
    description: 'AI-generated multiple choice questions',
    icon: HelpCircle,
  },
];

export default function AddEditFieldModal({ visible, onClose, onFieldAdded, field = null }) {
  const isEditMode = !!field;
  const [step, setStep] = useState(isEditMode ? 'configure' : 'selectType'); // 'selectType' or 'configure'
  const [selectedType, setSelectedType] = useState(field?.type || null);
  const [fieldName, setFieldName] = useState(field?.name || '');
  const [placeholderText, setPlaceholderText] = useState(field?.placeholder || '');
  const [helperText, setHelperText] = useState(field?.helperText || '');
  const [required, setRequired] = useState(field?.required || false);
  const [aiEnabled, setAiEnabled] = useState(field?.aiEnabled || false);
  const [requiredForGeneration, setRequiredForGeneration] = useState(field?.requiredForGeneration || false);
  const [fieldFor, setFieldFor] = useState(field?.fieldFor || 'designer');
  const [fieldNameError, setFieldNameError] = useState('');
  const [dropdownOptions, setDropdownOptions] = useState(field?.options ? (Array.isArray(field.options) ? field.options.join(', ') : field.options) : '');
  const [minSelections, setMinSelections] = useState(field?.min_selections || 0);
  const [maxSelections, setMaxSelections] = useState(field?.max_selections || 0);
  const [framework, setFramework] = useState(field?.framework || 'CCSS');

  // Update state when field prop changes
  useEffect(() => {
    if (field) {
      setStep('configure');
      setSelectedType(field.type);
      setFieldName(field.name);
      setPlaceholderText(field.placeholder || '');
      setHelperText(field.helperText || '');
      setRequired(field.required || false);
      setAiEnabled(field.aiEnabled || false);
      setRequiredForGeneration(field.requiredForGeneration || false);
      setFieldFor(field.fieldFor || 'designer');
      setDropdownOptions(field.options ? (Array.isArray(field.options) ? field.options.join(', ') : field.options) : '');
      setMinSelections(field.min_selections || 0);
      setMaxSelections(field.max_selections || 0);
      setFramework(field.framework || 'CCSS');
    }
  }, [field]);

  // Reset state when modal opens for adding a new field
  useEffect(() => {
    if (visible && !field) {
      // Reset all state for a fresh add
      setStep('selectType');
      setSelectedType(null);
      setFieldName('');
      setPlaceholderText('');
      setHelperText('');
      setRequired(false);
      setAiEnabled(false);
      setRequiredForGeneration(false);
      setFieldFor('designer');
      setFieldNameError('');
      setDropdownOptions('');
      setMinSelections(0);
      setMaxSelections(0);
      setFramework('CCSS');
    }
  }, [visible, field]);

  if (!visible) return null;

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setStep('configure');
  };

  const handleBack = () => {
    setStep('selectType');
    setSelectedType(null);
  };

  const handleClose = () => {
    if (!isEditMode) {
      setStep('selectType');
      setSelectedType(null);
      setFieldName('');
      setPlaceholderText('');
      setHelperText('');
      setRequired(false);
      setAiEnabled(false);
      setRequiredForGeneration(false);
      setFieldFor('designer');
    }
    onClose();
  };

  const handleSubmit = () => {
    if (!fieldName.trim()) {
      setFieldNameError('Please enter a field name');
      return;
    }

    const fieldData = {
      id: field?.id || Date.now().toString(),
      type: selectedType,
      name: fieldName,
      placeholder: placeholderText,
      helperText: helperText,
      required: required,
      aiEnabled: selectedType === 'mcqs' ? true : aiEnabled, // Auto-enable AI for MCQs
      requiredForGeneration: requiredForGeneration,
      fieldFor: fieldFor,
    };

    // Add options for dropdown types
    if (selectedType === 'grade_band_selector') {
      fieldData.options = gradeRangeConfig.gradeRanges;
    } else if (selectedType === 'theme_selector') {
      fieldData.options = themeSelectorConfig.themes;
    } else if (selectedType === 'dropdown' || selectedType === 'checklist') {
      fieldData.options = dropdownOptions.split(',').map(opt => opt.trim()).filter(opt => opt);
    }
    
    // Add min/max selections for checklist
    if (selectedType === 'checklist') {
      fieldData.min_selections = minSelections || 0;
      fieldData.max_selections = maxSelections || fieldData.options.length;
    }
    
    // Add framework for assign_standards field
    if (selectedType === 'assign_standards') {
      fieldData.framework = framework;
    }
    
    // Add framework for mcqs field
    if (selectedType === 'mcqs') {
      fieldData.framework = framework;
    }

    onFieldAdded(fieldData, isEditMode);
    handleClose();
  };

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
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--gray-900)',
            margin: 0
          }}>
            {step === 'selectType' 
              ? 'Select Field Type' 
              : `${isEditMode ? 'Edit' : 'Configure'} ${fieldTypes.find(f => f.type === selectedType)?.label}`}
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: 'var(--gray-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--gray-100)';
              e.currentTarget.style.color = 'var(--gray-900)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--gray-500)';
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {step === 'selectType' ? (
            // Step 1: Select Field Type
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {fieldTypes.map((fieldType) => {
                const Icon = fieldType.icon;
                return (
                  <button
                    key={fieldType.type}
                    onClick={() => handleTypeSelect(fieldType.type)}
                    style={{
                      padding: '1.5rem',
                      border: '2px solid var(--gray-200)',
                      borderRadius: '12px',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '1rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gray-200)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      flexShrink: 0
                    }}>
                      <Icon size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: 'var(--gray-900)',
                        margin: '0 0 0.25rem 0'
                      }}>
                        {fieldType.label}
                      </h3>
                      <p style={{
                        fontSize: '0.875rem',
                        color: 'var(--gray-600)',
                        margin: 0
                      }}>
                        {fieldType.description}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: 'var(--primary)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      Select
                      <ChevronRight size={16} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // Step 2: Configure Field
            <form onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}>
              {/* Field Name */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--gray-700)'
                }}>
                  Field Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={fieldName}
                  onChange={(e) => {
                    setFieldName(e.target.value);
                    if (fieldNameError) setFieldNameError('');
                  }}
                  placeholder="e.g., Learning Objective"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: `2px solid ${fieldNameError ? '#ef4444' : 'var(--gray-200)'}`,
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = fieldNameError ? '#ef4444' : 'var(--primary)';
                    e.currentTarget.style.boxShadow = fieldNameError ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = fieldNameError ? '#ef4444' : 'var(--gray-200)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                {fieldNameError && (
                  <p style={{
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#ef4444',
                    margin: '0.5rem 0 0 0'
                  }}>
                    {fieldNameError}
                  </p>
                )}
              </div>

              {/* Placeholder Text - only for text and rich_text */}
              {(selectedType === 'text' || selectedType === 'rich_text') && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: 'var(--gray-700)'
                  }}>
                    Placeholder Text
                  </label>
                  <input
                    type="text"
                    value={placeholderText}
                    onChange={(e) => setPlaceholderText(e.target.value)}
                    placeholder="e.g., Enter the learning objective..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid var(--gray-200)',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gray-200)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              )}

              {/* Helper Text */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--gray-700)'
                }}>
                  Helper Text
                </label>
                <TipTapEditor
                  content={helperText}
                  onChange={setHelperText}
                  placeholder="Enter helper text with formatting..."
                />
              </div>

              {/* Dropdown/Checklist Options */}
              {(selectedType === 'dropdown' || selectedType === 'checklist') && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--gray-700)'
                  }}>
                    {selectedType === 'checklist' ? 'Checklist Items' : 'Dropdown Options'} (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={dropdownOptions}
                    onChange={(e) => setDropdownOptions(e.target.value)}
                    placeholder="Option 1, Option 2, Option 3"
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '1px solid var(--gray-300)',
                      borderRadius: '6px',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              )}

              {/* Min/Max Selections for Checklist */}
              {selectedType === 'checklist' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--gray-700)'
                    }}>
                      Min Selections (0 = optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minSelections}
                      onChange={(e) => setMinSelections(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        border: '1px solid var(--gray-300)',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--gray-700)'
                    }}>
                      Max Selections (0 = unlimited)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={maxSelections}
                      onChange={(e) => setMaxSelections(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        border: '1px solid var(--gray-300)',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                </div>
              )}
              {/* Framework Selection for Assign Standards */}
              {selectedType === 'assign_standards' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--gray-700)'
                  }}>
                    Standards Framework
                  </label>
                  <select
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      border: '1px solid var(--gray-300)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      backgroundColor: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="CCSS">CCSS</option>
                    <option value="BLOOM">BLOOM</option>
                    <option value="TEKS">TEKS</option>
                    <option value="BEST">B.E.S.T.</option>
                    <option value="GSE">GSE</option>
                  </select>
                  <p style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    Select which framework standards to use for this field. Available: CCSS, BLOOM, TEKS, B.E.S.T., GSE.
                  </p>
                </div>
              )}
              {/* Grade Band Selector Info */}
              {selectedType === 'grade_band_selector' && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  color: '#6b7280'
                }}>
                  Grade ranges loaded from: <code style={{ 
                    backgroundColor: '#e5e7eb', 
                    padding: '0.125rem 0.375rem', 
                    borderRadius: '3px',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace'
                  }}>src/config/gradeRangeOptions.json</code>
                </div>
              )}

              {/* Theme Selector Info */}
              {selectedType === 'theme_selector' && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  color: '#6b7280'
                }}>
                  Themes loaded from: <code style={{ 
                    backgroundColor: '#e5e7eb', 
                    padding: '0.125rem 0.375rem', 
                    borderRadius: '3px',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace'
                  }}>src/config/themeSelectorOptions.json</code>
                </div>
              )}

              {/* MCQs Framework Selection */}
              {selectedType === 'mcqs' && (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--gray-700)'
                    }}>
                      Standards Framework
                    </label>
                    <select
                      value={framework}
                      onChange={(e) => setFramework(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        border: '1px solid var(--gray-300)',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        backgroundColor: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="CCSS">CCSS</option>
                      <option value="BLOOM">BLOOM</option>
                      <option value="TEKS">TEKS</option>
                      <option value="BEST">B.E.S.T.</option>
                      <option value="GSE">GSE</option>
                    </select>
                    <p style={{
                      marginTop: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      Select which framework standards to use for MCQ generation.
                    </p>
                  </div>
                  
                  <div style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    color: '#1e40af'
                  }}>
                    <strong>Note:</strong> This field generates 5 multiple choice questions. Each question can be individually regenerated with specific standards selected during the lesson creation process.
                  </div>
                </>
              )}

              {/* Checkboxes */}
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                gap: '2rem',
                flexWrap: 'wrap'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--gray-700)'
                }}>
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  Required Field
                </label>
                {selectedType !== 'grade_band_selector' && selectedType !== 'theme_selector' && selectedType !== 'mcqs' && (
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--gray-700)'
                  }}>
                    <input
                      type="checkbox"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    AI-Enabled Field
                  </label>
                )}
                {selectedType === 'mcqs' && (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#166534'
                  }}>
                    ✓ AI-Enabled by default
                  </div>
                )}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--gray-700)'
                }}>
                  <input
                    type="checkbox"
                    checked={requiredForGeneration}
                    onChange={(e) => setRequiredForGeneration(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  Required for default generation
                </label>
              </div>

              {/* Field For Selector */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                  color: 'var(--gray-700)'
                }}>
                  Field user: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{
                  display: 'flex',
                  gap: '1rem'
                }}>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem',
                    border: `2px solid ${fieldFor === 'designer' ? 'var(--primary)' : 'var(--gray-200)'}`,
                    borderRadius: '8px',
                    backgroundColor: fieldFor === 'designer' ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="radio"
                      name="fieldFor"
                      value="designer"
                      checked={fieldFor === 'designer'}
                      onChange={(e) => setFieldFor(e.target.value)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    <div>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: 'var(--gray-900)'
                      }}>
                        Designer
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--gray-600)',
                        marginTop: '0.125rem'
                      }}>
                        
                      </div>
                    </div>
                  </label>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem',
                    border: `2px solid ${fieldFor === 'builder' ? 'var(--primary)' : 'var(--gray-200)'}`,
                    borderRadius: '8px',
                    backgroundColor: fieldFor === 'builder' ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="radio"
                      name="fieldFor"
                      value="builder"
                      checked={fieldFor === 'builder'}
                      onChange={(e) => setFieldFor(e.target.value)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    <div>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: 'var(--gray-900)'
                      }}>
                        Builder
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--gray-600)',
                        marginTop: '0.125rem'
                      }}>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                paddingTop: '1rem',
                borderTop: '1px solid var(--gray-200)'
              }}>
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '2px solid var(--gray-300)',
                    borderRadius: '8px',
                    backgroundColor: '#fff',
                    color: 'var(--gray-700)',
                    fontWeight: 600,
                    fontSize: '1rem',
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
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '2px solid var(--gray-300)',
                    borderRadius: '8px',
                    backgroundColor: '#fff',
                    color: 'var(--gray-700)',
                    fontWeight: 600,
                    fontSize: '1rem',
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
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {isEditMode ? 'Update Field' : 'Add Field'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
