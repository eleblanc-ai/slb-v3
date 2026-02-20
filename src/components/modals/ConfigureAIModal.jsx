import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Eye } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { APP_CONFIG } from '../../config';
import { buildFullPrompt } from '../../ai/promptBuilder';
import { extractGradesFromBand, getCcssVocabularyStandardsForGrade, getMappedVocabularyStandardsForGrade, getCcssMainIdeaStandardsForGrade, getMappedMainIdeaStandardsForGrade } from '../../lib/standardsMapper';
import aiPromptDefaults from '../../config/aiPromptDefaults.json';
import { useToast } from '../../hooks/useToast';
import SyncConfirmModal from './ai-config/SyncConfirmModal';
import PromptPreviewPanel from './ai-config/PromptPreviewPanel';
import ContextFieldsPanel from './ai-config/ContextFieldsPanel';
import QuestionPromptsEditor from './ai-config/QuestionPromptsEditor';

/**
 * ConfigureAIModal - Modal for configuring AI generation settings for a field
 */
export default function ConfigureAIModal({ 
  visible, 
  onClose, 
  field,
  lessonTemplateId,
  lessonId,
  allFields = [],
  onSave,
  fieldValues = {},
  mode = 'template', // 'template' or 'lesson'
  defaultStandardFramework = 'CCSS'
}) {
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  // MCQ question prompts (q1-q5) - each question has its own prompt, label, and tooltip
  const [questionPrompts, setQuestionPrompts] = useState({
    q1: { prompt: '', label: '', tooltip: '', includeVocabStandards: false, includeMainIdeaStandards: false },
    q2: { prompt: '', label: '', tooltip: '', includeVocabStandards: false, includeMainIdeaStandards: false },
    q3: { prompt: '', label: '', tooltip: '', includeVocabStandards: false, includeMainIdeaStandards: false },
    q4: { prompt: '', label: '', tooltip: '', includeVocabStandards: false, includeMainIdeaStandards: false },
    q5: { prompt: '', label: '', tooltip: '', includeVocabStandards: false, includeMainIdeaStandards: false }
  });
  const [activeQuestionTab, setActiveQuestionTab] = useState(0);

  // Auto-resize textarea to fit content, preserving scroll position
  const autoResize = useCallback((el) => {
    if (!el) return;
    const scrollContainer = configPanelRef.current;
    const savedScroll = scrollContainer ? scrollContainer.scrollTop : 0;
    // Temporarily add a sentinel char so scrollHeight accounts for trailing newlines
    const val = el.value;
    const endsWithNewline = val.endsWith('\n') || val.endsWith('\r');
    if (endsWithNewline) el.value = val + '.';
    el.style.height = 'auto';
    const h = el.scrollHeight;
    if (endsWithNewline) el.value = val;
    el.style.height = h + 'px';
    if (scrollContainer) scrollContainer.scrollTop = savedScroll;
  }, []);

  // Strip TipTap HTML wrapping from DB values so textareas show clean plain text
  const stripHtml = (val) => {
    if (!val || typeof val !== 'string') return val || '';
    const trimmed = val.trim();
    if (!/<\/?[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
    // Not structured TipTap HTML — return as-is (plain text with literal tags)
    if (!/^<(?:p|h[1-6]|ul|ol|div|blockquote|table)\b/i.test(trimmed)) return trimmed;
    // 1. Strip actual HTML structure tags first.
    //    Entity-encoded tags (&lt;p&gt;) do NOT match /<[^>]*>/ so they survive.
    let text = trimmed
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<[^>]*>/g, '');
    // 2. Decode entities to reveal literal tag names.
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#0*39;/g, "'")
      .replace(/&#x0*27;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text;
  };

  const [systemInstructions, setSystemInstructions] = useState('');
  const [contextInstructions, setContextInstructions] = useState('');
  const [formatRequirements, setFormatRequirements] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const configPanelRef = useRef(null);
  const hasResizedAfterLoadRef = useRef(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [vocabStandards, setVocabStandards] = useState([]);
  const [mainIdeaStandards, setMainIdeaStandards] = useState([]);
  const allowSelfContext = field?.type === 'mcqs';
  const questionKeys = useMemo(() => ['q1', 'q2', 'q3', 'q4', 'q5'], []);

  const defaultSystemInstructions = 'You are an AI assistant helping to create educational content. Be clear, concise, and age-appropriate.';
  const defaultContextInstructions = 'Use the following context from other fields to inform your generation:';
  const defaultFormatReqs = 'Return plain text without markdown formatting.';

  // Get default prompts for MCQ questions
  const getDefaultQuestionPrompts = useCallback(() => {
    const defaults = aiPromptDefaults.fieldTypePrompts?.mcqs?.questionPrompts || {};
    return {
      q1: { 
        prompt: defaults.q1?.prompt || '', 
        label: defaults.q1?.label || 'Central Idea', 
        tooltip: defaults.q1?.tooltip || '',
        includeVocabStandards: defaults.q1?.includeVocabStandards || false,
        includeMainIdeaStandards: defaults.q1?.includeMainIdeaStandards || false
      },
      q2: { 
        prompt: defaults.q2?.prompt || '', 
        label: defaults.q2?.label || 'Vocabulary', 
        tooltip: defaults.q2?.tooltip || '',
        includeVocabStandards: defaults.q2?.includeVocabStandards || false,
        includeMainIdeaStandards: defaults.q2?.includeMainIdeaStandards || false
      },
      q3: { 
        prompt: defaults.q3?.prompt || '', 
        label: defaults.q3?.label || 'Evidence', 
        tooltip: defaults.q3?.tooltip || '',
        includeVocabStandards: defaults.q3?.includeVocabStandards || false,
        includeMainIdeaStandards: defaults.q3?.includeMainIdeaStandards || false
      },
      q4: { 
        prompt: defaults.q4?.prompt || '', 
        label: defaults.q4?.label || 'Inference', 
        tooltip: defaults.q4?.tooltip || '',
        includeVocabStandards: defaults.q4?.includeVocabStandards || false,
        includeMainIdeaStandards: defaults.q4?.includeMainIdeaStandards || false
      },
      q5: { 
        prompt: defaults.q5?.prompt || '', 
        label: defaults.q5?.label || 'Structure', 
        tooltip: defaults.q5?.tooltip || '',
        includeVocabStandards: defaults.q5?.includeVocabStandards || false,
        includeMainIdeaStandards: defaults.q5?.includeMainIdeaStandards || false
      }
    };
  }, []);

  // Auto-resize all textareas once after values first load (not on every keystroke)
  useEffect(() => {
    if (loading || !configPanelRef.current || hasResizedAfterLoadRef.current) return;
    hasResizedAfterLoadRef.current = true;
    const timer = setTimeout(() => {
      const textareas = configPanelRef.current?.querySelectorAll('textarea');
      textareas?.forEach(autoResize);
    }, 0);
    return () => clearTimeout(timer);
  }, [loading, systemInstructions, prompt, formatRequirements, contextInstructions, questionPrompts]);

  // Reset the flag when the modal opens for a different field
  useEffect(() => {
    hasResizedAfterLoadRef.current = false;
  }, [field?.id]);

  console.log('🔧 ConfigureAIModal mode:', mode, 'field:', field?.name);

  useEffect(() => {
    const loadVocabStandards = async () => {
      if (!field || field.type !== 'mcqs') {
        setVocabStandards([]);
        return;
      }

      const gradeField = allFields.find(f => f.type === 'grade_band_selector');
      const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
      const gradeValue = gradeField
        ? (fieldValues?.[gradeField.id] ?? storedFieldValues?.[gradeField.id])
        : null;
      const gradeLevels = extractGradesFromBand(gradeValue);

      if (defaultStandardFramework === 'CCSS') {
        const standards = await getCcssVocabularyStandardsForGrade(gradeLevels);
        setVocabStandards(standards);
      } else {
        const standards = await getMappedVocabularyStandardsForGrade(gradeLevels, defaultStandardFramework);
        setVocabStandards(standards);
      }
    };

    loadVocabStandards();
  }, [field, allFields, fieldValues, defaultStandardFramework]);

  useEffect(() => {
    const loadMainIdeaStandards = async () => {
      if (!field || field.type !== 'mcqs') {
        setMainIdeaStandards([]);
        return;
      }

      const gradeField = allFields.find(f => f.type === 'grade_band_selector');
      const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
      const gradeValue = gradeField
        ? (fieldValues?.[gradeField.id] ?? storedFieldValues?.[gradeField.id])
        : null;
      const gradeLevels = extractGradesFromBand(gradeValue);

      if (defaultStandardFramework === 'CCSS') {
        const standards = await getCcssMainIdeaStandardsForGrade(gradeLevels);
        setMainIdeaStandards(standards);
      } else {
        const standards = await getMappedMainIdeaStandardsForGrade(gradeLevels, defaultStandardFramework);
        setMainIdeaStandards(standards);
      }
    };

    loadMainIdeaStandards();
  }, [field, allFields, fieldValues, defaultStandardFramework]);

  

  const loadConfiguration = useCallback(async () => {
    const defaultQuestionPrompts = getDefaultQuestionPrompts();
    
    try {
      let configData = null;
      
      // In lesson mode, check user_ai_config first
      if (mode === 'lesson' && lessonId) {
        console.log('🔍 Checking for lesson-specific AI config');
        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('user_ai_config')
          .eq('id', lessonId)
          .single();
        
        if (!lessonError && lessonData?.user_ai_config && lessonData.user_ai_config[field.id]) {
          console.log('✅ Loading lesson-specific AI config');
          configData = lessonData.user_ai_config[field.id];
        }
      }
      
      // Fall back to template config if no lesson-specific config
      if (!configData) {
        console.log('📥 Loading template AI config');
        const { data, error } = await supabase
          .from('lesson_template_fields')
          .select('ai_prompt, ai_question_prompts, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
          .eq('id', field.id)
          .single();
        
        if (!error && data) {
          configData = data;
        }
      }
      
      if (configData) {
        setPrompt(stripHtml(configData.ai_prompt) || `Generate content for the ${field.name} field.`);
        // Load question prompts for MCQs
        if (configData.ai_question_prompts) {
          const savedPrompts = configData.ai_question_prompts;
          setQuestionPrompts({
            q1: { 
              prompt: stripHtml(savedPrompts.q1?.prompt || savedPrompts.q1) || defaultQuestionPrompts.q1.prompt, 
              label: savedPrompts.q1?.label || defaultQuestionPrompts.q1.label,
              tooltip: savedPrompts.q1?.tooltip || defaultQuestionPrompts.q1.tooltip,
              includeVocabStandards: savedPrompts.q1?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q1?.includeMainIdeaStandards || false
            },
            q2: { 
              prompt: stripHtml(savedPrompts.q2?.prompt || savedPrompts.q2) || defaultQuestionPrompts.q2.prompt, 
              label: savedPrompts.q2?.label || defaultQuestionPrompts.q2.label,
              tooltip: savedPrompts.q2?.tooltip || defaultQuestionPrompts.q2.tooltip,
              includeVocabStandards: savedPrompts.q2?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q2?.includeMainIdeaStandards || false
            },
            q3: { 
              prompt: stripHtml(savedPrompts.q3?.prompt || savedPrompts.q3) || defaultQuestionPrompts.q3.prompt, 
              label: savedPrompts.q3?.label || defaultQuestionPrompts.q3.label,
              tooltip: savedPrompts.q3?.tooltip || defaultQuestionPrompts.q3.tooltip,
              includeVocabStandards: savedPrompts.q3?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q3?.includeMainIdeaStandards || false
            },
            q4: { 
              prompt: stripHtml(savedPrompts.q4?.prompt || savedPrompts.q4) || defaultQuestionPrompts.q4.prompt, 
              label: savedPrompts.q4?.label || defaultQuestionPrompts.q4.label,
              tooltip: savedPrompts.q4?.tooltip || defaultQuestionPrompts.q4.tooltip,
              includeVocabStandards: savedPrompts.q4?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q4?.includeMainIdeaStandards || false
            },
            q5: { 
              prompt: stripHtml(savedPrompts.q5?.prompt || savedPrompts.q5) || defaultQuestionPrompts.q5.prompt, 
              label: savedPrompts.q5?.label || defaultQuestionPrompts.q5.label,
              tooltip: savedPrompts.q5?.tooltip || defaultQuestionPrompts.q5.tooltip,
              includeVocabStandards: savedPrompts.q5?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q5?.includeMainIdeaStandards || false
            }
          });
        } else {
          setQuestionPrompts(defaultQuestionPrompts);
        }
        setSystemInstructions(stripHtml(configData.ai_system_instructions) || defaultSystemInstructions);
        setContextInstructions(stripHtml(configData.ai_context_instructions) || defaultContextInstructions);
        setFormatRequirements(stripHtml(configData.ai_format_requirements) || defaultFormatReqs);
        setSelectedFields(configData.ai_context_field_ids || []);
      } else {
        setPrompt(`Generate content for the ${field.name} field.`);
        setQuestionPrompts(defaultQuestionPrompts);
        setSystemInstructions(defaultSystemInstructions);
        setContextInstructions(defaultContextInstructions);
        setFormatRequirements(defaultFormatReqs);
        setSelectedFields([]);
      }
    } catch (err) {
      console.error('Error loading AI config:', err);
      setPrompt(`Generate content for the ${field.name} field.`);
      setQuestionPrompts(defaultQuestionPrompts);
      setSystemInstructions(defaultSystemInstructions);
      setContextInstructions(defaultContextInstructions);
      setFormatRequirements(defaultFormatReqs);
      setSelectedFields([]);
    }
    
    setLoading(false);
  }, [field?.id, field?.name, mode, lessonId, getDefaultQuestionPrompts]);

  const buildCurrentConfigPayload = () => ({
    ai_prompt: prompt || null,
    ai_question_prompts: field?.type === 'mcqs' ? questionPrompts : null,
    ai_context_field_ids: selectedFields.length > 0 ? selectedFields : null,
    ai_system_instructions: systemInstructions || null,
    ai_context_instructions: contextInstructions || null,
    ai_format_requirements: formatRequirements || null
  });

  const downloadCurrentConfig = () => {
    if (!field) return;
    const payload = buildCurrentConfigPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${field.name || 'field'}-ai-config.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncFromTemplate = async () => {
    if (!lessonId || !field) return;
    setSyncing(true);
    try {
      const { data: templateData, error: templateError } = await supabase
        .from('lesson_template_fields')
        .select('ai_prompt, ai_question_prompts, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
        .eq('id', field.id)
        .single();

      if (templateError || !templateData) throw templateError || new Error('Template config not found');

      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .select('user_ai_config')
        .eq('id', lessonId)
        .single();

      if (lessonError) throw lessonError;

      const nextUserConfig = {
        ...(lessonData?.user_ai_config || {}),
        [field.id]: templateData
      };

      const { error: updateError } = await supabase
        .from('lessons')
        .update({ user_ai_config: nextUserConfig })
        .eq('id', lessonId);

      if (updateError) throw updateError;

      const defaultQuestionPrompts = getDefaultQuestionPrompts();

      setPrompt(stripHtml(templateData.ai_prompt) || `Generate content for the ${field.name} field.`);
      if (templateData.ai_question_prompts) {
        const savedPrompts = templateData.ai_question_prompts;
        setQuestionPrompts({
          q1: { 
            prompt: stripHtml(savedPrompts.q1?.prompt || savedPrompts.q1) || defaultQuestionPrompts.q1.prompt, 
            label: savedPrompts.q1?.label || defaultQuestionPrompts.q1.label,
            tooltip: savedPrompts.q1?.tooltip || defaultQuestionPrompts.q1.tooltip
          },
          q2: { 
            prompt: stripHtml(savedPrompts.q2?.prompt || savedPrompts.q2) || defaultQuestionPrompts.q2.prompt, 
            label: savedPrompts.q2?.label || defaultQuestionPrompts.q2.label,
            tooltip: savedPrompts.q2?.tooltip || defaultQuestionPrompts.q2.tooltip
          },
          q3: { 
            prompt: stripHtml(savedPrompts.q3?.prompt || savedPrompts.q3) || defaultQuestionPrompts.q3.prompt, 
            label: savedPrompts.q3?.label || defaultQuestionPrompts.q3.label,
            tooltip: savedPrompts.q3?.tooltip || defaultQuestionPrompts.q3.tooltip
          },
          q4: { 
            prompt: stripHtml(savedPrompts.q4?.prompt || savedPrompts.q4) || defaultQuestionPrompts.q4.prompt, 
            label: savedPrompts.q4?.label || defaultQuestionPrompts.q4.label,
            tooltip: savedPrompts.q4?.tooltip || defaultQuestionPrompts.q4.tooltip
          },
          q5: { 
            prompt: stripHtml(savedPrompts.q5?.prompt || savedPrompts.q5) || defaultQuestionPrompts.q5.prompt, 
            label: savedPrompts.q5?.label || defaultQuestionPrompts.q5.label,
            tooltip: savedPrompts.q5?.tooltip || defaultQuestionPrompts.q5.tooltip
          }
        });
      } else {
        setQuestionPrompts(defaultQuestionPrompts);
      }
      setSystemInstructions(stripHtml(templateData.ai_system_instructions) || defaultSystemInstructions);
      setContextInstructions(stripHtml(templateData.ai_context_instructions) || defaultContextInstructions);
      setFormatRequirements(stripHtml(templateData.ai_format_requirements) || defaultFormatReqs);
      setSelectedFields(templateData.ai_context_field_ids || []);

      if (onSave) {
        onSave({
          prompt: templateData.ai_prompt || '',
          questionPrompts: templateData.ai_question_prompts || null,
          contextFields: templateData.ai_context_field_ids || [],
          systemInstructions: templateData.ai_system_instructions || defaultSystemInstructions,
          contextInstructions: templateData.ai_context_instructions || defaultContextInstructions,
          formatRequirements: templateData.ai_format_requirements || defaultFormatReqs,
          selectedFieldIds: templateData.ai_context_field_ids || []
        }, { keepOpen: true, source: 'sync' });
      }

      setShowSyncConfirm(false);
    } catch (err) {
      console.error('Error syncing AI config:', err);
      toast.error('Failed to sync AI configuration from template. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const emptyQuestionPrompts = {
    q1: { prompt: '', label: '', tooltip: '' },
    q2: { prompt: '', label: '', tooltip: '' },
    q3: { prompt: '', label: '', tooltip: '' },
    q4: { prompt: '', label: '', tooltip: '' },
    q5: { prompt: '', label: '', tooltip: '' }
  };

  useEffect(() => {
    if (visible && field) {
      setLoading(true);
      setPrompt('');
      setQuestionPrompts(emptyQuestionPrompts);
      setActiveQuestionTab(0);
      setSystemInstructions('');
      setContextInstructions('');
      setFormatRequirements('');
      setSelectedFields([]);
      setShowPreview(false);
      loadConfiguration();
    } else if (!visible) {
      setPrompt('');
      setQuestionPrompts(emptyQuestionPrompts);
      setActiveQuestionTab(0);
      setSystemInstructions('');
      setContextInstructions('');
      setFormatRequirements('');
      setSelectedFields([]);
      setShowPreview(false);
      setLoading(false);
    }
  }, [visible, field?.id, loadConfiguration]);

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Only save to database in template mode
      if (mode === 'template') {
        const { error } = await supabase
          .from('lesson_template_fields')
          .update({
            ai_prompt: prompt || null,
            ai_question_prompts: field?.type === 'mcqs' ? questionPrompts : null,
            ai_context_field_ids: selectedFields.length > 0 ? selectedFields : null,
            ai_system_instructions: systemInstructions || null,
            ai_context_instructions: contextInstructions || null,
            ai_format_requirements: formatRequirements || null
          })
          .eq('id', field.id);
        
        if (error) throw error;
      }
      
      // Always call onSave callback to notify parent component
      if (onSave) {
        onSave({
          prompt,
          questionPrompts,
          contextFields: selectedFields,
          systemInstructions,
          contextInstructions,
          formatRequirements,
          selectedFieldIds: selectedFields
        });
      }
      
      onClose();
    } catch (err) {
      console.error('Error saving AI config:', err);
      toast.error('Failed to save AI configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (fieldId) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const selectAll = () => {
    setSelectedFields(
      allFields
        .filter(f => allowSelfContext || f.id !== field?.id)
        .map(f => f.id)
    );
  };

  const resetAll = () => {
    setPrompt(`Generate content for the ${field?.name} field.`);
    setQuestionPrompts(getDefaultQuestionPrompts());
    setSystemInstructions('You are an AI assistant helping to create educational content. Be clear, concise, and age-appropriate.');
    setContextInstructions('Use the following context from other fields to inform your generation:');
    setFormatRequirements('Return plain text without markdown formatting.');
    setSelectedFields([]);
  };

  // Build prompt preview - must be before conditional return
  const promptPreview = useMemo(() => {
    // Read field values from localStorage
    const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
    const extraContextBlocks = [];
    
    // For MCQ fields, only show standards if checkboxes are checked for the active question
    if (field?.type === 'mcqs') {
      const activeQuestionKey = questionKeys[activeQuestionTab];
      const activeQuestionConfig = questionPrompts[activeQuestionKey];
      
      if (activeQuestionConfig?.includeVocabStandards && vocabStandards.length > 0) {
        extraContextBlocks.push({
          title: 'Grade-Specific Vocabulary Standards',
          content: vocabStandards.join('; ')
        });
      }
      if (activeQuestionConfig?.includeMainIdeaStandards && mainIdeaStandards.length > 0) {
        extraContextBlocks.push({
          title: 'Grade-Specific Main Idea Standards',
          content: mainIdeaStandards.join('; ')
        });
      }
    }

    return buildFullPrompt({
      systemInstructions,
      prompt,
      formatRequirements,
      contextInstructions,
      selectedFieldIds: selectedFields,
      allFields,
      fieldValues: storedFieldValues,
      extraContextBlocks
    });
  }, [prompt, systemInstructions, contextInstructions, formatRequirements, selectedFields, allFields, vocabStandards, mainIdeaStandards, activeQuestionTab, questionPrompts, questionKeys, field]);

  if (!visible || !field) return null;

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
        borderRadius: '16px',
        maxWidth: '1400px',
        width: '95%',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #fafafa, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
            }}>
              ⚡
            </div>
            <div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--gray-900)',
                margin: 0,
                lineHeight: 1.2
              }}>
                Configure AI Generation
              </h2>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)',
                marginTop: '0.25rem'
              }}>
                <strong style={{ color: 'var(--primary)' }}>{field.name}</strong>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {mode === 'lesson' && (
              <button
                onClick={() => setShowSyncConfirm(true)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#1d4ed8',
                  background: '#eff6ff',
                  border: '2px solid #93c5fd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#dbeafe';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
              >
                Sync from Template
              </button>
            )}
            <button
              onClick={() => setShowPreview(!showPreview)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: showPreview ? 'var(--primary)' : 'var(--gray-700)',
                background: '#fff',
                border: `2px solid ${showPreview ? 'var(--primary)' : 'var(--gray-300)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = showPreview ? '#eff6ff' : 'var(--gray-50)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
              }}
            >
              <Eye size={16} />
              Preview
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--gray-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
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
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          background: 'var(--gray-50)',
          minHeight: 0
        }}>
          {showPreview ? (
            <PromptPreviewPanel promptPreview={promptPreview} />
          ) : (
            <>
              <div ref={configPanelRef} style={{
                width: (mode === 'template' || (mode === 'lesson' && selectedFields.length > 0)) ? '65%' : '100%',
                padding: '1.5rem',
                overflowY: 'auto',
                background: '#fff',
                minHeight: 0
              }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                    Loading configuration...
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--gray-900)',
                        display: 'block',
                        marginBottom: '0.5rem'
                      }}>
                        System Instructions
                      </label>
                      <textarea
                        ref={autoResize}
                        value={systemInstructions}
                        onChange={(e) => { setSystemInstructions(e.target.value); autoResize(e.target); }}
                        placeholder="e.g., You are an AI assistant..."
                        style={{
                          width: '100%',
                          minHeight: '110px',
                          padding: '0.75rem',
                          fontSize: '0.8125rem',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          border: '1px solid var(--gray-300)',
                          borderRadius: '8px',
                          resize: 'vertical',
                          outline: 'none',
                          lineHeight: 1.6,
                          boxSizing: 'border-box',
                          color: 'var(--gray-900)',
                          background: '#fff',
                          overflow: 'hidden',
                        }}
                      />
                    </div>

                    {/* Hide Field Prompt for MCQ fields - MCQs use individual question prompts instead */}
                    {field?.type !== 'mcqs' && (
                    <div style={{
                      marginBottom: '1.5rem',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      padding: '1.25rem',
                      borderRadius: '12px',
                      border: '2px solid #60a5fa'
                    }}>
                      <label style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#1e40af',
                        display: 'block',
                        marginBottom: '0.5rem'
                      }}>
                        Field Prompt
                      </label>
                      <textarea
                        ref={autoResize}
                        value={prompt}
                        onChange={(e) => { setPrompt(e.target.value); autoResize(e.target); }}
                        placeholder="Example: Generate..."
                        style={{
                          width: '100%',
                          minHeight: '140px',
                          padding: '0.75rem',
                          fontSize: '0.8125rem',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          border: '2px solid #60a5fa',
                          borderRadius: '8px',
                          resize: 'vertical',
                          outline: 'none',
                          lineHeight: 1.6,
                          boxSizing: 'border-box',
                          color: 'var(--gray-900)',
                          background: '#fff',
                          overflow: 'hidden',
                        }}
                      />
                    </div>
                    )}

                    {field?.type === 'mcqs' && (
                      <QuestionPromptsEditor
                        questionPrompts={questionPrompts}
                        onChangeQuestionPrompts={setQuestionPrompts}
                        activeTab={activeQuestionTab}
                        onChangeActiveTab={setActiveQuestionTab}
                        questionKeys={questionKeys}
                        vocabStandards={vocabStandards}
                        mainIdeaStandards={mainIdeaStandards}
                        mode={mode}
                      />
                    )}

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--gray-900)',
                        display: 'block',
                        marginBottom: '0.5rem'
                      }}>
                        Format Requirements
                      </label>
                      <textarea
                        ref={autoResize}
                        value={formatRequirements}
                        onChange={(e) => { setFormatRequirements(e.target.value); autoResize(e.target); }}
                        placeholder="e.g., Return only plain text..."
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '0.75rem',
                          fontSize: '0.8125rem',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          border: '1px solid var(--gray-300)',
                          borderRadius: '8px',
                          resize: 'vertical',
                          outline: 'none',
                          lineHeight: 1.6,
                          boxSizing: 'border-box',
                          color: 'var(--gray-900)',
                          background: '#fff',
                          overflow: 'hidden',
                        }}
                      />
                    </div>

                    {selectedFields.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--gray-900)',
                          display: 'block',
                          marginBottom: '0.5rem'
                        }}>
                          Context Instructions
                        </label>
                        <textarea
                          ref={autoResize}
                          value={contextInstructions}
                          onChange={(e) => { setContextInstructions(e.target.value); autoResize(e.target); }}
                          placeholder="e.g., Use the following context..."
                          style={{
                            width: '100%',
                            minHeight: '90px',
                            padding: '0.75rem',
                            fontSize: '0.8125rem',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            border: '1px solid var(--gray-300)',
                            borderRadius: '8px',
                            resize: 'vertical',
                            outline: 'none',
                            lineHeight: 1.6,
                            boxSizing: 'border-box',
                            color: 'var(--gray-900)',
                            background: '#fff',
                            overflow: 'hidden',
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {mode === 'lesson' && selectedFields.length > 0 && (
                <ContextFieldsPanel
                  mode="lesson"
                  allFields={allFields}
                  selectedFields={selectedFields}
                  allowSelfContext={allowSelfContext}
                  currentFieldId={field?.id}
                />
              )}

              {mode === 'template' && (
                <ContextFieldsPanel
                  mode="template"
                  allFields={allFields}
                  selectedFields={selectedFields}
                  onToggleField={toggleField}
                  allowSelfContext={allowSelfContext}
                  currentFieldId={field?.id}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--gray-200)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          background: 'linear-gradient(to right, #fafafa, #ffffff)'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--gray-700)',
                background: '#fff',
                border: '2px solid var(--gray-300)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.5rem 1.5rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#fff',
                background: saving ? 'var(--gray-400)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {saving ? 'Saving...' : (mode === 'lesson' ? 'Save Lesson Config' : 'Save Configuration')}
            </button>
          </div>
        </div>
      </div>

      {showSyncConfirm && (
        <SyncConfirmModal
          visible={showSyncConfirm}
          fieldName={field?.name}
          syncing={syncing}
          onSync={handleSyncFromTemplate}
          onCancel={() => setShowSyncConfirm(false)}
          onDownloadBackup={downloadCurrentConfig}
        />
      )}
    </div>
  );
}
