import TextField from '../fields/TextField';
import RichTextField from '../fields/RichTextField';
import DropdownField from '../fields/DropdownField';
import ChecklistField from '../fields/ChecklistField';
import ImageField from '../fields/ImageField';
import AssignStandardsField from '../fields/AssignStandardsField';
import MCQsField from '../fields/MCQsField';
import BaseField from '../fields/BaseField';

/**
 * Renders the appropriate field component based on field.type.
 *
 * Shared between CreateNewLesson (lesson editing) and CreateNewLessonType (template editing).
 *
 * Props:
 *  - field            – field definition object
 *  - value            – current field value
 *  - onChange          – (value) => void
 *  - isMissing        – highlight as missing context field
 *  - isUsedAsContext   – show context indicator (lesson mode only, optional)
 *  - onEdit           – edit handler (template mode only, optional)
 *  - onDelete         – delete handler (template mode only, optional)
 *  - onGenerateAI     – AI generation handler
 *  - onAIConfig       – open AI config modal
 *  - isGenerating     – whether this field is currently generating
 *  - hasGenerated     – whether this field has been generated
 *  - onGenerateIndividualMCQ – individual MCQ generation handler (MCQs only)
 *  - defaultStandardFramework – e.g. 'CCSS' (MCQs only)
 */
export default function FieldRenderer({
  field,
  value,
  onChange,
  isMissing = false,
  isUsedAsContext,
  onEdit,
  onDelete,
  onGenerateAI,
  onAIConfig,
  isGenerating = false,
  hasGenerated = false,
  onGenerateIndividualMCQ,
  defaultStandardFramework,
}) {
  // Build shared AI props only if the field is AI-enabled
  const aiProps = field.aiEnabled
    ? { onGenerateAI, onAIConfig, isGenerating, hasGenerated }
    : {};

  // Build optional edit/delete props (template mode)
  const editProps = {};
  if (onEdit) editProps.onEdit = onEdit;
  if (onDelete) editProps.onDelete = onDelete;

  // Build optional context prop (lesson mode)
  const contextProps = {};
  if (isUsedAsContext !== undefined) contextProps.isUsedAsContext = isUsedAsContext;

  const common = { field, onChange, isMissing, ...editProps, ...contextProps, ...aiProps };

  if (field.type === 'text') {
    return <TextField {...common} value={value || ''} />;
  }

  if (field.type === 'rich_text') {
    return <RichTextField {...common} value={value || ''} />;
  }

  if (
    field.type === 'grade_band_selector' ||
    field.type === 'theme_selector' ||
    field.type === 'dropdown'
  ) {
    return <DropdownField {...common} value={value || ''} />;
  }

  if (field.type === 'checklist') {
    return <ChecklistField {...common} value={value || []} />;
  }

  if (field.type === 'image') {
    return (
      <ImageField
        {...common}
        value={value || { description: '', url: '', altText: '', imageModel: '', altTextModel: '' }}
      />
    );
  }

  if (field.type === 'assign_standards') {
    return <AssignStandardsField {...common} value={value || []} />;
  }

  if (field.type === 'mcqs') {
    // Extract question labels from ai_question_prompts for display
    const questionLabels = {};
    if (field.ai_question_prompts) {
      ['q1', 'q2', 'q3', 'q4', 'q5'].forEach((qKey) => {
        const qData = field.ai_question_prompts[qKey];
        if (qData) {
          questionLabels[qKey] = {
            label: typeof qData === 'string' ? null : qData.label,
            tooltip: typeof qData === 'string' ? null : qData.tooltip,
          };
        }
      });
    }

    return (
      <MCQsField
        field={{ ...field, questionLabels }}
        value={value || { questions: ['', '', '', '', ''] }}
        onChange={onChange}
        onAIGenerate={field.aiEnabled ? () => onGenerateAI(field) : undefined}
        onGenerateIndividual={field.aiEnabled ? onGenerateIndividualMCQ : undefined}
        onAIConfig={onAIConfig}
        isMissing={isMissing}
        {...contextProps}
        {...editProps}
        isGenerating={isGenerating}
        defaultStandardFramework={defaultStandardFramework}
      />
    );
  }

  // Fallback for unknown field types
  return <BaseField {...common} />;
}
