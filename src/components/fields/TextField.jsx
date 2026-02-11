import BaseField from './BaseField';

/**
 * TextField - Renders a simple text input field
 */
export default function TextField({ 
  field, 
  value, 
  onChange, 
  onEdit, 
  onDelete,
  onGenerateAI,
  onAIConfig,
  isGenerating,
  hasGenerated,
  hideRequiredAsterisk
}) {
  return (
    <BaseField 
      field={field} 
      onEdit={onEdit} 
      onDelete={onDelete}
      onGenerateAI={onGenerateAI}
      onAIConfig={onAIConfig}
      isGenerating={isGenerating}
      hasGenerated={hasGenerated}
      hideRequiredAsterisk={hideRequiredAsterisk}
    >
      <div style={{ marginTop: '0.75rem' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={field.placeholder || 'Enter text...'}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid var(--gray-300)',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: 'var(--gray-900)',
            backgroundColor: '#fff',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-300)';
          }}
        />
      </div>
    </BaseField>
  );
}
