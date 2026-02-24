import React from 'react';
import BaseField from './BaseField';

export default function DropdownField({ field, value, onChange, onEdit, onDelete, onAIConfig, onGenerateAI, isGenerating, hasGenerated, isMissing, staleContextNames, onDismissStale, hideRequiredAsterisk }) {
  // Ensure options is an array; some DB rows may store JSON or comma-separated strings
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

  const displayPlaceholder = field.placeholder_text || "Select one";

  return (
    <BaseField 
      field={field}
      onEdit={onEdit} 
      onDelete={onDelete}
      onAIConfig={onAIConfig}
      onGenerateAI={onGenerateAI}
      isGenerating={isGenerating}
      hasGenerated={hasGenerated}
      isMissing={isMissing}
      staleContextNames={staleContextNames}
      onDismissStale={onDismissStale}
      hideRequiredAsterisk={hideRequiredAsterisk}
    >
      <div style={{ marginTop: '0.75rem' }}>
        <select
          style={{
            width: '100%',
            padding: '0.625rem',
            border: '1px solid var(--gray-300)',
            borderRadius: '6px',
            fontSize: '0.875rem',
            backgroundColor: '#fff',
            cursor: 'pointer'
          }}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          aria-label={field.name}
        >
          <option value="">{displayPlaceholder}</option>
          {parsedOptions.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </BaseField>
  );
}
