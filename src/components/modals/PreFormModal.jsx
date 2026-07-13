import React from 'react';
import { Sparkles, X, Upload, FileDown } from 'lucide-react';
import { parseMarkdownImport, applyImportToFields, generateFormatTemplate } from '../../import/markdownImporter';
import TextField from '../fields/TextField';
import RichTextField from '../fields/RichTextField';
import DropdownField from '../fields/DropdownField';
import ChecklistField from '../fields/ChecklistField';
import ImageField from '../fields/ImageField';
import AssignStandardsField from '../fields/AssignStandardsField';
import BaseField from '../fields/BaseField';
import { APP_CONFIG } from '../../config';
import gradeRangeConfig from '../../config/gradeRangeOptions.json';
import themeSelectorConfig from '../../config/themeSelectorOptions.json';

export default function PreFormModal({
  visible,
  onClose,
  onCancel,
  fields = [],
  fieldValues = {},
  onFieldChange,
  onImport,
  templateName,
  allFields = [],
}) {
  // Fields required for AI generation
  const requiredFields = fields.filter(f => f.requiredForGeneration);

  // Check if all required fields are filled
  const allRequiredFieldsFilled = requiredFields.every(field => {
    if (field.type === 'section_header') return true;
    if (field.type === 'vocabulary_words' || field.type === 'mcqs') return true;
    
    const value = fieldValues[field.id];
    if (!value) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (field.type === 'image' && typeof value === 'object') {
      return value.url && value.url.trim() !== '';
    }
    return true;
  });

  const [importMessage, setImportMessage] = React.useState(null);
  const fileInputRef = React.useRef(null);

  // Hooks must run on every render, so keep this guard below all hook calls.
  if (!visible) return null;

  const handleDownloadFormat = () => {
    const fieldsForFormat = allFields.length > 0 ? allFields : fields;
    const template = generateFormatTemplate(fieldsForFormat, templateName || 'Lesson');
    const blob = new Blob([template], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(templateName || 'lesson').replace(/[^a-zA-Z0-9]/g, '-')}-import-format.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const parsed = parseMarkdownImport(text);
      const fieldsForImport = allFields.length > 0 ? allFields : fields;
      const { values, count, notFoundStandards, missingFields } = await applyImportToFields(parsed, fieldsForImport);

      if (count === 0 && notFoundStandards.length === 0 && missingFields.length === 0) {
        setImportMessage({ text: 'No matching fields found in the uploaded file.', type: 'error' });
        return;
      }

      // Set values via onFieldChange for preform fields (so UI updates)
      Object.entries(values).forEach(([fieldId, value]) => {
        onFieldChange(fieldId, value);
      });

      // Also call onImport for non-preform fields
      if (onImport) {
        onImport(values);
      }

      // Build feedback message
      const parts = [];
      if (count > 0) parts.push(`Imported ${count} field${count !== 1 ? 's' : ''}.`);
      if (notFoundStandards.length > 0) parts.push(`Standards not found: ${notFoundStandards.join(', ')}`);
      if (missingFields.length > 0) parts.push(`Not in import: ${missingFields.join(', ')}`);

      const hasWarnings = notFoundStandards.length > 0 || missingFields.length > 0;
      setImportMessage({ text: parts.join(' '), type: hasWarnings ? 'warning' : 'success' });
      setTimeout(() => setImportMessage(null), hasWarnings ? 8000 : 4000);
    };
    reader.readAsText(file);

    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  // Render fields helper function
  const renderFields = (fieldsToRender) => {
    if (fieldsToRender.length === 0) {
      return (
        <div style={{
          textAlign: 'center',
          color: 'var(--gray-600)',
          padding: '2rem'
        }}>
          No fields to display.
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {fieldsToRender.map((field) => {
          let fieldComponent;
          const commonProps = {
            field,
            value: fieldValues[field.id] || '',
            onChange: (value) => onFieldChange(field.id, value),
            hideRequiredAsterisk: true
          };

          switch (field.type) {
            case 'text':
              fieldComponent = <TextField key={field.id} {...commonProps} />;
              break;
            case 'rich_text':
              fieldComponent = <RichTextField key={field.id} {...commonProps} />;
              break;
            case 'dropdown':
              fieldComponent = <DropdownField key={field.id} {...commonProps} />;
              break;
            case 'checklist':
              fieldComponent = <ChecklistField key={field.id} {...commonProps} />;
              break;
            case 'grade_band_selector':
              fieldComponent = (
                <DropdownField
                  key={field.id}
                  {...commonProps}
                  field={{
                    ...field,
                    options: gradeRangeConfig.gradeRanges
                  }}
                />
              );
              break;
            case 'theme_selector':
              fieldComponent = (
                <DropdownField
                  key={field.id}
                  {...commonProps}
                  field={{
                    ...field,
                    options: themeSelectorConfig.themes
                  }}
                />
              );
              break;
            case 'image':
              fieldComponent = <ImageField key={field.id} {...commonProps} />;
              break;
            case 'assign_standards':
              fieldComponent = (
                <AssignStandardsField
                  key={field.id}
                  {...commonProps}
                  value={fieldValues[field.id] || []}
                />
              );
              break;
            case 'section_header':
              fieldComponent = (
                <BaseField
                  key={field.id}
                  field={field}
                />
              );
              break;
            case 'vocabulary_words':
            case 'mcqs':
              fieldComponent = (
                <div key={field.id} style={{ 
                  padding: '1rem',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  color: '#0369a1'
                }}>
                  <strong>{field.name}</strong> - This field can be filled in the main form after continuing.
                </div>
              );
              break;
            default:
              fieldComponent = (
                <div key={field.id} style={{ 
                  padding: '1rem',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px',
                  color: '#92400e'
                }}>
                  <strong>{field.name}</strong> - Field type "{field.type}" not supported in pre-form
                </div>
              );
          }

          return fieldComponent;
        })}
      </div>
    );
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
        maxWidth: '1400px',
        width: '95%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--gray-200)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <Sparkles size={24} style={{ color: '#3b82f6' }} />
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--gray-900)',
                margin: 0
              }}>
                Required for AI Generation
              </h2>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)',
                margin: '0.25rem 0 0 0'
              }}>
                Fill in these fields so AI can generate your lesson content
              </p>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
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
                title="Close"
              >
                <X size={24} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ 
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1
        }}>
          {renderFields(requiredFields)}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid var(--gray-200)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
            <button
              onClick={handleDownloadFormat}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'transparent',
                color: 'var(--gray-600)',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--gray-300)';
                e.currentTarget.style.color = 'var(--gray-600)';
              }}
              title="Download a format template for this lesson type"
            >
              <FileDown size={15} />
              Download Format
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'transparent',
                color: 'var(--gray-600)',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--gray-300)';
                e.currentTarget.style.color = 'var(--gray-600)';
              }}
              title="Import field values from a markdown file"
            >
              <Upload size={15} />
              Import
            </button>
            {importMessage && (
              <span style={{
                fontSize: '0.8125rem',
                color: importMessage.type === 'error' ? '#dc2626' : importMessage.type === 'warning' ? '#d97706' : '#059669',
                fontWeight: 500,
                maxWidth: '400px',
                lineHeight: '1.4'
              }}>
                {importMessage.text}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={!allRequiredFieldsFilled}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: allRequiredFieldsFilled ? '#3b82f6' : 'var(--gray-300)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: allRequiredFieldsFilled ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              opacity: allRequiredFieldsFilled ? 1 : 0.6
            }}
            onMouseOver={(e) => {
              if (allRequiredFieldsFilled) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseOut={(e) => {
              if (allRequiredFieldsFilled) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            Continue to Lesson Editor
          </button>
        </div>
      </div>
    </div>
  );
}
