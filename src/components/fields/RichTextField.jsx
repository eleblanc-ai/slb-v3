import BaseField from './BaseField';
import TipTapEditor from '../core/TipTapEditor';

/**
 * RichTextField - Renders a rich text editor field
 */
export default function RichTextField({ 
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
        <TipTapEditor
          content={value || ''}
          placeholder={field.placeholder || 'Enter rich text...'}
          onChange={onChange}
        />
      </div>
    </BaseField>
  );
}
