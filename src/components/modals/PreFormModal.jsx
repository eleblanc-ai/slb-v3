import React, { useState } from 'react';
import { ClipboardList, Sparkles, FileEdit, ArrowRight, ArrowLeft } from 'lucide-react';
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
  fields = [],
  fieldValues = {},
  onFieldChange
}) {
  const [currentStep, setCurrentStep] = useState(1);
  
  if (!visible) return null;

  // Step 1: Fields required for AI generation
  const requiredFields = fields.filter(f => f.requiredForGeneration);
  
  // Step 2: Manual entry fields (not AI-enabled and not required)
  const manualFields = fields.filter(f => !f.aiEnabled && !f.requiredForGeneration);
  
  console.log('📋 PreFormModal rendered with:', {
    visible,
    currentStep,
    totalFields: fields.length,
    requiredFieldsCount: requiredFields.length,
    manualFieldsCount: manualFields.length,
    requiredFields: requiredFields.map(f => ({ name: f.name, type: f.type })),
    manualFields: manualFields.map(f => ({ name: f.name, type: f.type }))
  });

  // Check if all required fields (Step 1) are filled
  const allRequiredFieldsFilled = requiredFields.every(field => {
    // Section headers don't need to be filled
    if (field.type === 'section_header') return true;
    
    // Vocabulary words and MCQs can be skipped in pre-form (they're too complex)
    if (field.type === 'vocabulary_words' || field.type === 'mcqs') return true;
    
    const value = fieldValues[field.id];
    if (!value) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    
    // For image fields, check if URL exists
    if (field.type === 'image' && typeof value === 'object') {
      return value.url && value.url.trim() !== '';
    }
    
    return true;
  });

  const handleNext = () => {
    if (allRequiredFieldsFilled) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleContinue = () => {
    onClose();
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
            key: field.id,
            field,
            value: fieldValues[field.id] || '',
            onChange: (value) => onFieldChange(field.id, value)
          };

          switch (field.type) {
            case 'text':
              fieldComponent = <TextField {...commonProps} />;
              break;
            case 'rich_text':
              fieldComponent = <RichTextField {...commonProps} />;
              break;
            case 'dropdown':
              fieldComponent = <DropdownField {...commonProps} />;
              break;
            case 'checklist':
              fieldComponent = <ChecklistField {...commonProps} />;
              break;
            case 'grade_band_selector':
              fieldComponent = (
                <DropdownField
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
                  {...commonProps}
                  field={{
                    ...field,
                    options: themeSelectorConfig.themes
                  }}
                />
              );
              break;
            case 'image':
              fieldComponent = <ImageField {...commonProps} />;
              break;
            case 'assign_standards':
              fieldComponent = (
                <AssignStandardsField
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
              // These complex field types can't be easily edited in pre-form
              fieldComponent = (
                <div style={{ 
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
                <div style={{ 
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

  // Determine which fields to show based on current step
  const currentFields = currentStep === 1 ? requiredFields : manualFields;
  const stepIcon = currentStep === 1 ? Sparkles : FileEdit;
  const stepTitle = currentStep === 1 ? 'Required for AI Generation' : 'Manual Entry Fields';
  const stepDescription = currentStep === 1 
    ? 'Fill in these fields so AI can generate your lesson content'
    : 'These fields won\'t be AI-generated. Fill them now or skip and complete them later';

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
            gap: '0.75rem',
            marginBottom: '0.5rem'
          }}>
            {React.createElement(stepIcon, { size: 24, style: { color: '#3b82f6' } })}
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--gray-900)',
                margin: 0
              }}>
                {stepTitle}
              </h2>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)',
                margin: '0.25rem 0 0 0'
              }}>
                {stepDescription}
              </p>
            </div>
          </div>
          {/* Progress Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1rem'
          }}>
            <div style={{
              flex: 1,
              height: '4px',
              backgroundColor: currentStep >= 1 ? '#3b82f6' : 'var(--gray-200)',
              borderRadius: '2px',
              transition: 'background-color 0.3s ease'
            }} />
            <div style={{
              flex: 1,
              height: '4px',
              backgroundColor: currentStep >= 2 ? '#3b82f6' : 'var(--gray-200)',
              borderRadius: '2px',
              transition: 'background-color 0.3s ease'
            }} />
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--gray-500)',
            marginTop: '0.5rem',
            textAlign: 'center',
            fontWeight: 600
          }}>
            Step {currentStep} of 2
          </div>
        </div>

        {/* Content */}
        <div style={{ 
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1
        }}>
          {renderFields(currentFields)}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid var(--gray-200)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div>
            {currentStep === 2 && (
              <button
                onClick={handleBack}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#fff',
                  color: '#3b82f6',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                }}
              >
                <ArrowLeft size={18} />
                Back
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            {currentStep === 1 ? (
              <button
                onClick={handleNext}
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
                  opacity: allRequiredFieldsFilled ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
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
                Next
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleContinue}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                Continue to Lesson Editor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
