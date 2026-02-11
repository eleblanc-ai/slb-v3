import React, { useState, useEffect } from 'react';
import BaseField from './BaseField';

export default function ChecklistField({ field, value, onChange, onEdit, onDelete, onAIConfig, onGenerateAI, isGenerating, hasGenerated, hideRequiredAsterisk }) {
  const [error, setError] = useState('');
  
  // Debug logging
  console.log('ChecklistField - field:', field);
  console.log('ChecklistField - field.options:', field.options);
  
  // Parse options from comma-separated string or array
  let parsedOptions = [];
  if (Array.isArray(field.options)) {
    parsedOptions = field.options;
  } else if (typeof field.options === 'string') {
    try {
      parsedOptions = JSON.parse(field.options);
      if (!Array.isArray(parsedOptions)) parsedOptions = field.options.split(',').map((s) => s.trim());
    } catch (e) {
      parsedOptions = field.options.split(',').map((s) => s.trim());
    }
  }
  
  console.log('ChecklistField - parsedOptions:', parsedOptions);

  // Parse current value (array of selected items)
  let selectedItems = [];
  if (Array.isArray(value)) {
    selectedItems = value;
  } else if (typeof value === 'string') {
    try {
      selectedItems = JSON.parse(value);
      if (!Array.isArray(selectedItems)) selectedItems = [];
    } catch (e) {
      selectedItems = value ? value.split(',').map((s) => s.trim()) : [];
    }
  }

  const minSelections = field.min_selections || 0;
  const maxSelections = field.max_selections || parsedOptions.length;

  const handleToggle = (option) => {
    let newSelected;
    if (selectedItems.includes(option)) {
      // Deselecting
      newSelected = selectedItems.filter(item => item !== option);
      if (minSelections > 0 && newSelected.length < minSelections) {
        setError(`You must select at least ${minSelections} option${minSelections > 1 ? 's' : ''}`);
        return;
      }
    } else {
      // Selecting
      if (selectedItems.length >= maxSelections) {
        setError(`You can select at most ${maxSelections} option${maxSelections > 1 ? 's' : ''}`);
        return;
      }
      newSelected = [...selectedItems, option];
    }
    setError('');
    onChange?.(newSelected);
  };

  // Validate on value change
  useEffect(() => {
    if (selectedItems.length < minSelections && selectedItems.length > 0) {
      setError(`Select at least ${minSelections} option${minSelections > 1 ? 's' : ''}`);
    } else if (selectedItems.length > maxSelections) {
      setError(`Select at most ${maxSelections} option${maxSelections > 1 ? 's' : ''}`);
    } else {
      setError('');
    }
  }, [selectedItems.length, minSelections, maxSelections]);

  return (
    <BaseField 
      field={field}
      onEdit={onEdit} 
      onDelete={onDelete}
      onAIConfig={onAIConfig}
      onGenerateAI={onGenerateAI}
      isGenerating={isGenerating}
      hasGenerated={hasGenerated}
      hideRequiredAsterisk={hideRequiredAsterisk}
    >
      <div style={{ marginTop: '0.75rem' }}>
        {/* Selection requirements message */}
        {parsedOptions.length > 0 && (minSelections > 0 || maxSelections < parsedOptions.length) && (
          <div style={{ 
            color: 'var(--gray-600)', 
            fontSize: '0.8125rem',
            marginBottom: '0.75rem',
            marginTop: 0,
            padding: '0.5rem 0.75rem',
            background: 'var(--gray-50)',
            borderRadius: '6px',
            border: '1px solid var(--gray-200)'
          }}>
            {minSelections > 0 && maxSelections < parsedOptions.length
              ? `Please select between ${minSelections} and ${maxSelections} option${maxSelections > 1 ? 's' : ''}`
              : minSelections > 0
              ? `Please select at least ${minSelections} option${minSelections > 1 ? 's' : ''}`
              : `Please select up to ${maxSelections} option${maxSelections > 1 ? 's' : ''}`
            }
          </div>
        )}
        
        {parsedOptions.map((option, index) => (
          <label
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--gray-700)'
            }}
          >
            <input
              type="checkbox"
              checked={selectedItems.includes(option)}
              onChange={() => handleToggle(option)}
              style={{
                width: '1rem',
                height: '1rem',
                cursor: 'pointer',
                accentColor: 'var(--primary)'
              }}
            />
            <span>{option}</span>
          </label>
        ))}
        {parsedOptions.length === 0 && (
          <p style={{ 
            color: 'var(--gray-400)', 
            fontSize: '0.875rem',
            fontStyle: 'italic',
            margin: 0
          }}>
            No checklist items configured
          </p>
        )}
        {error && (
          <p style={{ 
            color: '#ef4444', 
            fontSize: '0.75rem',
            marginTop: '0.5rem',
            marginBottom: 0
          }}>
            {error}
          </p>
        )}
        {(minSelections > 0 || maxSelections < parsedOptions.length) && (
          <p style={{ 
            color: 'var(--gray-500)', 
            fontSize: '0.75rem',
            marginTop: '0.5rem',
            marginBottom: 0
          }}>
            {selectedItems.length} selected
            {minSelections > 0 && maxSelections < parsedOptions.length && ` (${minSelections}-${maxSelections} required)`}
            {minSelections > 0 && maxSelections >= parsedOptions.length && ` (min ${minSelections} required)`}
            {minSelections === 0 && maxSelections < parsedOptions.length && ` (max ${maxSelections})`}
          </p>
        )}
      </div>
    </BaseField>
  );
}
