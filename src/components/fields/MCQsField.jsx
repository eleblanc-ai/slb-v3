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
  Sparkles,
} from 'lucide-react';
import BaseField from './BaseField';
import StandardsSearch from './StandardsSearch';
import StandardsBadges from './StandardsBadges';

const ToolbarButton = ({
  onClick,
  active = false,
  disabled = false,
  label,
  children,
}) => {
  return (
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
        opacity: disabled ? 0.5 : 1
      }}
      aria-label={label}
      title={label}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = '#f1f5f9';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {children}
    </button>
  );
};

export default function MCQsField({
  field,
  value = {},
  onChange,
  onAIGenerate,
  onGenerateIndividual,
  onAIConfig,
  onEdit,
  onDelete,
  isGenerating = false,
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [generatingQuestion, setGeneratingQuestion] = useState(null);
  const updateTimerRef = useRef(null);
  const isUserEditingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  
  // Track selected standards per question (index -> standard object or null)
  // Initialize from value prop if available
  const [questionStandards, setQuestionStandards] = useState(value?.standards || {});
  
  // Sync questionStandards when value.standards changes (e.g., when loaded from database)
  useEffect(() => {
    if (value?.standards) {
      setQuestionStandards(value.standards);
    }
  }, [value?.standards]);
  
  // Initialize value structure if empty
  const questions = value?.questions || Array(5).fill('');
  const sourceStandards = value?.sourceStandards || {};
  const filteredOutStandards = value?.filteredOutStandards || {};
  
  const handleQuestionChange = (index, content, updatedFilteredOut = null) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = content;
    onChange({ 
      questions: updatedQuestions,
      standards: questionStandards,
      sourceStandards: sourceStandards,
      filteredOutStandards: updatedFilteredOut !== null ? updatedFilteredOut : filteredOutStandards
    });
  };
  
  const handleStandardChange = (index, standard) => {
    const updatedStandards = {
      ...questionStandards,
      [index]: standard
    };
    setQuestionStandards(updatedStandards);
    // Propagate the change to parent component, preserving sourceStandards and filteredOutStandards
    onChange({ 
      questions: questions,
      standards: updatedStandards,
      sourceStandards: sourceStandards,
      filteredOutStandards: filteredOutStandards
    });
  };
  
  const handleRestoreStandard = (index, code, updatedContent) => {
    // Remove the restored standard from filteredOutStandards for this question
    const currentFiltered = filteredOutStandards[index] || [];
    const newFiltered = currentFiltered.filter(s => s !== code);
    const updatedFilteredOut = {
      ...filteredOutStandards,
      [index]: newFiltered
    };
    
    // Update the question content and filteredOutStandards together
    handleQuestionChange(index, updatedContent, updatedFilteredOut);
  };
  
  const handleRegenerateQuestion = (index) => {
    console.log('🎯 handleRegenerateQuestion called with index:', index);
    console.log('🎯 onGenerateIndividual exists?', !!onGenerateIndividual);
    const selectedStandard = questionStandards[index];
    console.log('🎯 Selected standard for question', index, ':', selectedStandard);
    if (onGenerateIndividual) {
      setGeneratingQuestion(index);
      onGenerateIndividual(field.id, index, selectedStandard).finally(() => setGeneratingQuestion(null));
    } else {
      console.error('❌ onGenerateIndividual is not defined!');
    }
  };
  
  console.log('🎨 MCQsField rendering, activeTab:', activeTab, 'questions:', questions);
  console.log('🎨 MCQsField props:', { field: field?.name, hasOnAIGenerate: !!onAIGenerate, hasOnGenerateIndividual: !!onGenerateIndividual });
  
  return (
    <BaseField 
      field={field} 
      onAIConfig={onAIConfig} 
      onEdit={onEdit} 
      onDelete={onDelete}
      onGenerateAI={onAIGenerate}
      customGenerateLabel="Generate All 5 Questions"
      isGenerating={isGenerating}
    >
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          {[0, 1, 2, 3, 4].map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveTab(index)}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                background: activeTab === index ? '#fff' : 'transparent',
                borderBottom: activeTab === index ? '3px solid #3b82f6' : '3px solid transparent',
                color: activeTab === index ? '#1e293b' : '#64748b',
                fontWeight: activeTab === index ? 600 : 400,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px'
              }}
            >
              Question {index + 1}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        <div style={{ padding: 16 }}>
          {[0, 1, 2, 3, 4].map((index) => (
            <div 
              key={index} 
              style={{ display: activeTab === index ? 'block' : 'none' }}
            >
              <QuestionEditor
                value={questions[index] || ''}
                onChange={(content) => handleQuestionChange(index, content)}
                placeholder={`Question ${index + 1} will be generated here...`}
                isGenerating={generatingQuestion === index}
                onRegenerate={() => handleRegenerateQuestion(index)}
                selectedStandard={questionStandards[index]}
                onStandardChange={(standard) => handleStandardChange(index, standard)}
                field={field}
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

// Individual Question Editor Component
function QuestionEditor({ value, onChange, placeholder, isGenerating, onRegenerate, selectedStandard, onStandardChange, field, sourceStandard, filteredOutStandards, onRestoreStandard }) {
  const updateTimerRef = useRef(null);
  const isUserEditingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  
  const editor = useEditor({
    extensions: [
      Heading.configure({ levels: [2, 3] }),
      StarterKit.configure({
        strike: false,
        heading: false,
      }),
      Underline.configure({
        HTMLAttributes: {},
      }),
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
      Placeholder.configure({
        placeholder: placeholder,
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      
      // Mark as initialized on first update
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
      }
      
      isUserEditingRef.current = true;
      
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      
      updateTimerRef.current = setTimeout(() => {
        const html = editor.getHTML();
        onChange(html);
        
        setTimeout(() => {
          isUserEditingRef.current = false;
        }, 100);
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
      
      const currentPosition = editor.state.selection.$anchor.pos;
      
      editor.commands.setContent(incoming, { emitUpdate: false });
      
      if (incoming && incoming.trim()) {
        hasInitializedRef.current = true;
      }
      
      setTimeout(() => {
        try {
          const docSize = editor.state.doc.content.size;
          const safePosition = Math.min(currentPosition, docSize - 1);
          if (safePosition > 0) {
            editor.commands.setTextSelection(safePosition);
          }
        } catch (e) {
          // ignore
        }
      }, 0);
    }
  }, [value, editor, isGenerating]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isGenerating);
  }, [isGenerating, editor]);
  
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  if (!editor) {
    return (
      <div style={{
        border: '2px solid #e2e8f0',
        borderRadius: 8,
        minHeight: 200,
        background: '#f8fafc'
      }} />
    );
  }

  const canUndo = editor.can().chain().undo().run();
  const canRedo = editor.can().chain().redo().run();

  return (
    <div>
      {/* Standards Search and Regenerate Button */}
      {onRegenerate && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          <StandardsSearch
            selectedStandard={selectedStandard}
            onStandardChange={onStandardChange}
            defaultFramework={field.framework || 'CCSS'}
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
              whiteSpace: 'nowrap'
            }}
          >
            {isGenerating ? '⏳ Generating...' : (value && value.trim() ? '🔄 Regenerate This Question' : '✨ Generate This Question')}
          </button>
        </div>
      )}
      
      <div style={{ 
        border: '2px solid #e2e8f0', 
        borderRadius: 8,
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          flexWrap: 'wrap'
        }}>
          <ToolbarButton
            label="Heading 2"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Heading 3"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 size={16} />
          </ToolbarButton>

          <div style={{ 
            width: 1, 
            height: 20, 
            background: '#cbd5e1', 
            margin: '0 4px' 
          }} />

          <ToolbarButton
            label="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldIcon size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Underline"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon size={16} />
          </ToolbarButton>

          <div style={{ 
            width: 1, 
            height: 20, 
            background: '#cbd5e1', 
            margin: '0 4px' 
          }} />

          <ToolbarButton
            label="Bullet List"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Numbered List"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={16} />
          </ToolbarButton>

          <div style={{ 
            width: 1, 
            height: 20, 
            background: '#cbd5e1', 
            margin: '0 4px' 
          }} />

          <ToolbarButton
            label="Undo"
            disabled={!canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 size={16} />
          </ToolbarButton>

          <ToolbarButton
            label="Redo"
            disabled={!canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 size={16} />
          </ToolbarButton>
        </div>

        <div style={{
          minHeight: 200,
          padding: 16
        }}>
          <EditorContent 
            editor={editor} 
            style={{ outline: 'none' }}
          />
        </div>
      </div>
      
      {/* Display standards badges with tooltips and source standard */}
      <StandardsBadges 
        htmlContent={value} 
        onChange={onChange ? (updatedContent) => onChange(updatedContent) : null}
        sourceStandard={sourceStandard}
        pendingStandard={selectedStandard}
        filteredOutStandards={filteredOutStandards}
        onRestoreStandard={onRestoreStandard}
      />
    </div>
  );
}
