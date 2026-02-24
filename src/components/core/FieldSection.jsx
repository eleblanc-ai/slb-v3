import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableField from './SortableField';
import FieldRenderer from './FieldRenderer';
import LayoutToggle from './LayoutToggle';
import { Plus } from 'lucide-react';
import { gradientButton, liftOnHover } from '../../styles/shared';

/**
 * A complete Designer or Builder field section with header, DnD wrapper,
 * and field rendering.  Shared between CreateNewLesson and CreateNewLessonType.
 *
 * Props:
 *  - sectionLabel       – 'Designer' or 'Builder'
 *  - fieldType          – 'designer' | 'builder'
 *  - fields             – all fields array
 *  - fieldValues        – current values object
 *  - setFieldValues     – state setter (used for non-user changes & fallback)
 *  - onFieldChanged     – (fieldId, value) => void  (lesson mode: updates value + stale detection)
 *  - sensors            – DnD sensors
 *  - handleDragEnd      – (event, fieldType) => void
 *  - layoutMode         – 'stacked' | 'side-by-side'
 *  - setLayoutMode      – state setter
 *  - showControls       – whether to show the layout toggle (& Add Field) in this section
 *  - highlightedMissingFields – Set of field ids to highlight
 *  - generatingFieldId  – id of currently-generating field (or null)
 *  - hasGeneratedMap    – { [fieldId]: boolean }
 *  - handleGenerateAI   – AI generation handler
 *  - handleAIConfig     – open AI config modal
 *  - handleGenerateIndividualMCQ – individual MCQ handler
 *  - defaultStandardFramework   – e.g. 'CCSS'
 *  - isFieldUsedAsContext       – (fieldId) => boolean  (lesson mode only, optional)
 *  - onEditField        – (field) => void  (template mode only, optional)
 *  - onDeleteField      – (fieldId) => void  (template mode only, optional)
 *  - onAddField         – () => void  (template mode only, optional)
 */
export default function FieldSection({
  sectionLabel,
  fieldType,
  fields,
  fieldValues,
  setFieldValues,
  onFieldChanged,
  sensors,
  handleDragEnd,
  layoutMode,
  setLayoutMode,
  showControls,
  highlightedMissingFields,
  generatingFieldId,
  hasGeneratedMap,
  handleGenerateAI,
  handleAIConfig,
  handleGenerateIndividualMCQ,
  defaultStandardFramework,
  isFieldUsedAsContext,
  staleContextMap,
  onDismissStale,
  onEditField,
  onDeleteField,
  onAddField,
  onUploadImage,
}) {
  const sectionFields = fields.filter((f) => f.fieldFor === fieldType);

  // Use onFieldChanged (which includes stale detection) when available,
  // otherwise fall back to raw setFieldValues (template mode).
  const makeOnChange = (fieldId) => (value) => {
    if (onFieldChanged) {
      onFieldChanged(fieldId, value);
    } else {
      setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    }
  };

  return (
    <div style={{ minWidth: 0 }}>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '2px solid var(--gray-200)',
          minHeight: '3rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--gray-900)',
              margin: 0,
            }}
          >
            {sectionLabel} Field{sectionFields.length === 1 ? '' : 's'}
          </h3>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#dbeafe',
              color: 'var(--primary)',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {sectionFields.length}
          </span>
        </div>

        {showControls && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Add Field Button (template mode only) */}
            {onAddField && (
              <button
                onClick={onAddField}
                style={gradientButton('var(--primary)', 'var(--secondary)', '59, 130, 246')}
                {...liftOnHover('59, 130, 246')}
              >
                <Plus size={16} />
                Add Field
              </button>
            )}

            <LayoutToggle layoutMode={layoutMode} onModeChange={setLayoutMode} />
          </div>
        )}
      </div>

      {/* Field List */}
      {sectionFields.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--gray-400)',
            fontSize: '0.875rem',
          }}
        >
          No {fieldType} fields added yet
        </div>
      ) : sensors ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(event, fieldType)}
        >
          <SortableContext
            items={sectionFields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                paddingLeft: '2rem',
              }}
            >
              {sectionFields.map((field) => {
                const isMissing = highlightedMissingFields.has(field.id);
                const usedAsCtx =
                  isFieldUsedAsContext ? isFieldUsedAsContext(field.id) : undefined;

                return (
                  <SortableField key={field.id} id={field.id}>
                    <FieldRenderer
                      field={field}
                      value={fieldValues[field.id]}
                      onChange={makeOnChange(field.id)}
                      isMissing={isMissing}
                      isUsedAsContext={usedAsCtx}
                      onEdit={onEditField}
                      onDelete={onDeleteField}
                      onGenerateAI={handleGenerateAI}
                      onAIConfig={handleAIConfig}
                      isGenerating={generatingFieldId === field.id}
                      hasGenerated={!!hasGeneratedMap[field.id]}
                      onGenerateIndividualMCQ={handleGenerateIndividualMCQ}
                      defaultStandardFramework={defaultStandardFramework}
                      staleContextNames={staleContextMap?.[field.id] || []}
                      onDismissStale={onDismissStale ? () => onDismissStale(field.id) : undefined}
                      onUploadImage={onUploadImage}
                    />
                  </SortableField>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {sectionFields.map((field) => {
            const isMissing = highlightedMissingFields.has(field.id);
            const usedAsCtx =
              isFieldUsedAsContext ? isFieldUsedAsContext(field.id) : undefined;

            return (
              <FieldRenderer
                key={field.id}
                field={field}
                value={fieldValues[field.id]}
                onChange={makeOnChange(field.id)}
                isMissing={isMissing}
                isUsedAsContext={usedAsCtx}
                onEdit={onEditField}
                onDelete={onDeleteField}
                onGenerateAI={handleGenerateAI}
                onAIConfig={handleAIConfig}
                isGenerating={generatingFieldId === field.id}
                hasGenerated={!!hasGeneratedMap[field.id]}
                onGenerateIndividualMCQ={handleGenerateIndividualMCQ}
                defaultStandardFramework={defaultStandardFramework}
                staleContextNames={staleContextMap?.[field.id] || []}
                onDismissStale={onDismissStale ? () => onDismissStale(field.id) : undefined}
                onUploadImage={onUploadImage}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
