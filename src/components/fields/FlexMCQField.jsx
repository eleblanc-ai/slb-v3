import { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import {
  Heading2,
  Heading3,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Plus,
  X as XIcon,
} from 'lucide-react';
import BaseField from './BaseField';
import StandardsSearch from './StandardsSearch';
import StandardsBadges from './StandardsBadges';
import aiPromptDefaults from '../../config/aiPromptDefaults.json';

const TABS_PER_ROW = 5;

const ToolbarButton = ({ onClick, active = false, disabled = false, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '6px 8px',
      border: 'none',
      background: active ? '#e0e7ff' : 'transparent',
      color: active ? '#4f46e5' : '#64748b',
      borderRadius: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s',
      opacity: disabled ? 0.5 : 1,
    }}
    aria-label={label}
    title={label}
    onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.background = '#f1f5f9'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >
    {children}
  </button>
);

function reindexMap(map, removedIndex) {
  const result = {};
  Object.keys(map).forEach((k) => {
    const ki = parseInt(k, 10);
    if (ki < removedIndex) result[ki] = map[ki];
    else if (ki > removedIndex) result[ki - 1] = map[ki];
  });
  return result;
}

export default function FlexMCQField({
  field,
  value = {},
  onChange,
  onAIGenerate,
  onGenerateIndividual,
  onAIConfig,
  onEdit,
  onDelete,
  isGenerating = false,
  isMissing,
  staleContextNames,
  onDismissStale,
  defaultStandardFramework = 'CCSS',
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [generatingQuestion, setGeneratingQuestion] = useState(null);
  const [hoveredTab, setHoveredTab] = useState(null);
  const hasNormalizedRef = useRef(false);

  const [questionStandards, setQuestionStandards] = useState(value?.standards || {});

  useEffect(() => {
    if (value?.standards) setQuestionStandards(value.standards);
  }, [value?.standards]);

  const defaultCount = field?.defaultQuestionCount || 5;
  const questions = value?.questions?.length ? value.questions : Array(defaultCount).fill('');
  const sourceStandards = value?.sourceStandards || {};
  const filteredOutStandards = value?.filteredOutStandards || {};

  const normalizeContent = (content) => {
    if (!content || typeof content !== 'string') return '';
    const trimmed = content.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower.includes('<p') || lower.includes('<br') || lower.includes('<div') || lower.includes('</')) return trimmed;
    return `<p>${trimmed.replace(/\n+/g, '<br>')}</p>`;
  };

  const normalizedQuestions = questions.map(normalizeContent);

  useEffect(() => {
    if (!onChange || hasNormalizedRef.current) return;
    hasNormalizedRef.current = true;
    const hasDiff = normalizedQuestions.some((q, idx) => q !== questions[idx]);
    // Always fire onChange on mount to populate fieldValues, even if no normalization diff
    onChange({ questions: hasDiff ? normalizedQuestions : questions, standards: questionStandards, sourceStandards, filteredOutStandards });
  }, [onChange, normalizedQuestions, questions, questionStandards, sourceStandards, filteredOutStandards]);

  const emitChange = (updatedQuestions, updatedStandards, updatedSource, updatedFiltered) => {
    onChange({
      questions: updatedQuestions,
      standards: updatedStandards,
      sourceStandards: updatedSource,
      filteredOutStandards: updatedFiltered,
    });
  };

  const handleQuestionChange = (index, content, updatedFilteredOut = null) => {
    const updated = [...questions];
    updated[index] = content;
    emitChange(updated, questionStandards, sourceStandards, updatedFilteredOut !== null ? updatedFilteredOut : filteredOutStandards);
  };

  const handleStandardChange = (index, standard) => {
    const updated = { ...questionStandards, [index]: standard };
    setQuestionStandards(updated);
    emitChange(questions, updated, sourceStandards, filteredOutStandards);
  };

  const handleRestoreStandard = (index, code, updatedContent) => {
    const currentFiltered = filteredOutStandards[index] || [];
    const newFiltered = currentFiltered.filter((s) => s !== code);
    handleQuestionChange(index, updatedContent, { ...filteredOutStandards, [index]: newFiltered });
  };

  const handleAddQuestion = () => {
    const updated = [...questions, ''];
    emitChange(updated, questionStandards, sourceStandards, filteredOutStandards);
    setActiveTab(updated.length - 1);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((_, i) => i !== index);
    const newActive = activeTab >= updated.length
      ? updated.length - 1
      : activeTab === index
        ? Math.max(0, index - 1)
        : activeTab > index
          ? activeTab - 1
          : activeTab;
    const updatedStandards = reindexMap(questionStandards, index);
    setQuestionStandards(updatedStandards);
    emitChange(updated, updatedStandards, reindexMap(sourceStandards, index), reindexMap(filteredOutStandards, index));
    setActiveTab(newActive);
  };

  const handleRegenerateQuestion = (index) => {
    const selectedStandard = questionStandards[index];
    if (onGenerateIndividual) {
      setGeneratingQuestion(index);
      onGenerateIndividual(field.id, index, selectedStandard).finally(() => setGeneratingQuestion(null));
    }
  };

  const needsWrap = questions.length > TABS_PER_ROW;

  // Q1-Q5 use the MCQs prompts; anything beyond Q5 reuses Q5's config
  const getQuestionConfig = (index) => {
    const cappedIndex = Math.min(index, 4);
    const questionKey = `q${cappedIndex + 1}`;
    const defaults = aiPromptDefaults.fieldTypePrompts?.mcqs?.questionPrompts?.[questionKey] || {};
    const fieldConfig = field?.questionLabels?.[questionKey] || {};
    return {
      label: fieldConfig.label || defaults.label || `Q${index + 1}`,
      tooltip: fieldConfig.tooltip || defaults.tooltip || '',
    };
  };

  return (
    <BaseField
      field={field}
      onAIConfig={onAIConfig}
      onEdit={onEdit}
      onDelete={onDelete}
      onGenerateAI={onAIGenerate}
      customGenerateLabel={`Generate All ${questions.length} Question${questions.length !== 1 ? 's' : ''}`}
      isGenerating={isGenerating}
      isMissing={isMissing}
      staleContextNames={staleContextNames}
      onDismissStale={onDismissStale}
    >
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex',
          flexWrap: needsWrap ? 'wrap' : 'nowrap',
          borderBottom: needsWrap ? 'none' : '2px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          {questions.map((_, index) => {
            const config = getQuestionConfig(index);
            return (
            <button
              key={index}
              type="button"
              onClick={() => setActiveTab(index)}
              onMouseEnter={() => setHoveredTab(index)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                flex: needsWrap ? `0 0 ${100 / TABS_PER_ROW}%` : 1,
                padding: '8px 6px',
                border: 'none',
                borderBottom: activeTab === index ? '3px solid #3b82f6' : '3px solid transparent',
                background: activeTab === index ? '#fff' : 'transparent',
                color: activeTab === index ? '#1e293b' : '#64748b',
                fontWeight: activeTab === index ? 600 : 400,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: needsWrap ? 0 : '-2px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13 }}>Q{index + 1}</span>
                {questions.length > 1 && (
                  <span
                    role="button"
                    title="Remove question"
                    onClick={(e) => { e.stopPropagation(); handleRemoveQuestion(index); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: hoveredTab === index ? '#fee2e2' : 'transparent',
                      color: hoveredTab === index ? '#ef4444' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 10,
                      transition: 'all 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    <XIcon size={10} />
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10,
                opacity: activeTab === index ? 1 : 0.7,
                color: activeTab === index ? '#3b82f6' : '#64748b',
              }}>
                {config.label}
              </span>

              {/* Tooltip */}
              {hoveredTab === index && config.tooltip && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 8,
                  padding: '8px 12px',
                  background: '#1e293b',
                  color: '#fff',
                  fontSize: 11,
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  {config.tooltip}
                  <div style={{
                    position: 'absolute',
                    top: -4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderBottom: '5px solid #1e293b',
                  }} />
                </div>
              )}
            </button>
            );
          })}

          {/* Add Question button */}
          <button
            type="button"
            onClick={handleAddQuestion}
            title="Add question"
            style={{
              flex: needsWrap ? `0 0 ${100 / TABS_PER_ROW}%` : '0 0 auto',
              padding: '8px 10px',
              border: 'none',
              borderBottom: '3px solid transparent',
              background: 'transparent',
              color: '#3b82f6',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.2s',
              marginBottom: needsWrap ? 0 : '-2px',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>

        {/* Bottom border when wrapping (drawn below the tab rows) */}
        {needsWrap && (
          <div style={{ height: 2, background: '#e2e8f0' }} />
        )}

        {/* Tab content */}
        <div style={{ padding: 16 }}>
          {questions.map((_, index) => (
            <div key={index} style={{ display: activeTab === index ? 'block' : 'none' }}>
              <QuestionEditor
                value={normalizedQuestions[index] || ''}
                onChange={(content) => handleQuestionChange(index, content)}
                placeholder={`Question ${index + 1} content...`}
                isGenerating={generatingQuestion === index}
                onRegenerate={onGenerateIndividual ? () => handleRegenerateQuestion(index) : undefined}
                selectedStandard={questionStandards[index]}
                onStandardChange={(standard) => handleStandardChange(index, standard)}
                field={field}
                defaultStandardFramework={defaultStandardFramework}
                sourceStandard={sourceStandards[index]}
                filteredOutStandards={filteredOutStandards[index]}
                onRestoreStandard={(code, updatedContent) => handleRestoreStandard(index, code, updatedContent)}
              />
            </div>
          ))}
        </div>
      </div>
    </BaseField>
  );
}

// ── Question Editor ──────────────────────────────────────────────────────────

function QuestionEditor({
  value, onChange, placeholder, isGenerating, onRegenerate,
  selectedStandard, onStandardChange, field, defaultStandardFramework,
  sourceStandard, filteredOutStandards, onRestoreStandard,
}) {
  const updateTimerRef = useRef(null);
  const isUserEditingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      Heading.configure({ levels: [2, 3] }),
      StarterKit.configure({ strike: false, heading: false }),
      Underline.configure({ HTMLAttributes: {} }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      if (!hasInitializedRef.current) hasInitializedRef.current = true;
      isUserEditingRef.current = true;
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = setTimeout(() => {
        onChange(editor.getHTML());
        setTimeout(() => { isUserEditingRef.current = false; }, 100);
      }, 300);
    },
    editable: !isGenerating,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (current !== incoming && !isGenerating) {
      if (isUserEditingRef.current) return;
      const pos = editor.state.selection.$anchor.pos;
      editor.commands.setContent(incoming, { emitUpdate: false });
      if (incoming?.trim()) hasInitializedRef.current = true;
      setTimeout(() => {
        try {
          const docSize = editor.state.doc.content.size;
          const safe = Math.min(pos, docSize - 1);
          if (safe > 0) editor.commands.setTextSelection(safe);
        } catch (_) {}
      }, 0);
    }
  }, [value, editor, isGenerating]);

  useEffect(() => {
    if (editor) editor.setEditable(!isGenerating);
  }, [isGenerating, editor]);

  useEffect(() => () => { if (updateTimerRef.current) clearTimeout(updateTimerRef.current); }, []);

  if (!editor) {
    return <div style={{ border: '2px solid #e2e8f0', borderRadius: 8, minHeight: 200, background: '#f8fafc' }} />;
  }

  const canUndo = editor.can().chain().undo().run();
  const canRedo = editor.can().chain().redo().run();

  return (
    <div>
      {onRegenerate && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          <StandardsSearch
            selectedStandard={selectedStandard}
            onStandardChange={onStandardChange}
            defaultFramework={defaultStandardFramework || field?.framework || 'CCSS'}
          />
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              background: isGenerating ? '#e2e8f0' : 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
              color: isGenerating ? '#94a3b8' : '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {isGenerating ? '⏳ Generating...' : (value?.trim() ? '🔄 Regenerate This Question' : '✨ Generate This Question')}
          </button>
        </div>
      )}

      <div style={{ border: '2px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc', flexWrap: 'wrap',
        }}>
          <ToolbarButton label="Heading 2" active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={16} />
          </ToolbarButton>
          <ToolbarButton label="Heading 3" active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={16} />
          </ToolbarButton>
          <div style={{ width: 1, height: 20, background: '#cbd5e1', margin: '0 4px' }} />
          <ToolbarButton label="Bold" active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}>
            <BoldIcon size={16} />
          </ToolbarButton>
          <ToolbarButton label="Italic" active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}>
            <ItalicIcon size={16} />
          </ToolbarButton>
          <ToolbarButton label="Underline" active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={16} />
          </ToolbarButton>
          <div style={{ width: 1, height: 20, background: '#cbd5e1', margin: '0 4px' }} />
          <ToolbarButton label="Bullet List" active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={16} />
          </ToolbarButton>
          <ToolbarButton label="Numbered List" active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={16} />
          </ToolbarButton>
          <div style={{ width: 1, height: 20, background: '#cbd5e1', margin: '0 4px' }} />
          <ToolbarButton label="Undo" disabled={!canUndo}
            onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 size={16} />
          </ToolbarButton>
          <ToolbarButton label="Redo" disabled={!canRedo}
            onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 size={16} />
          </ToolbarButton>
        </div>

        <div style={{ minHeight: 200, padding: 16 }}>
          <EditorContent editor={editor} style={{ outline: 'none' }} />
        </div>
      </div>

      <StandardsBadges
        htmlContent={value}
        onChange={onChange ? (updated) => onChange(updated) : null}
        sourceStandard={sourceStandard}
        pendingStandard={selectedStandard}
        filteredOutStandards={filteredOutStandards}
        onRestoreStandard={onRestoreStandard}
      />
    </div>
  );
}
