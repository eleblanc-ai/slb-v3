import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { APP_CONFIG } from '../../config';
import { buildFullPrompt } from '../../lib/promptBuilder';
import { extractGradeFromBand, getCcssVocabularyStandardsForGrade, getMappedVocabularyStandardsForGrade, getCcssMainIdeaStandardsForGrade, getMappedMainIdeaStandardsForGrade } from '../../lib/standardsMapper';
import aiPromptDefaults from '../../config/aiPromptDefaults.json';
import TipTapEditor from '../core/TipTapEditor';

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
  const [systemInstructions, setSystemInstructions] = useState('');
  const [contextInstructions, setContextInstructions] = useState('');
  const [formatRequirements, setFormatRequirements] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
      const gradeLevel = extractGradeFromBand(gradeValue);

      if (defaultStandardFramework === 'CCSS') {
        const standards = await getCcssVocabularyStandardsForGrade(gradeLevel);
        setVocabStandards(standards);
      } else {
        const standards = await getMappedVocabularyStandardsForGrade(gradeLevel, defaultStandardFramework);
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
      const gradeLevel = extractGradeFromBand(gradeValue);

      if (defaultStandardFramework === 'CCSS') {
        const standards = await getCcssMainIdeaStandardsForGrade(gradeLevel);
        setMainIdeaStandards(standards);
      } else {
        const standards = await getMappedMainIdeaStandardsForGrade(gradeLevel, defaultStandardFramework);
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
        setPrompt(configData.ai_prompt || `Generate content for the ${field.name} field.`);
        // Load question prompts for MCQs
        if (configData.ai_question_prompts) {
          const savedPrompts = configData.ai_question_prompts;
          setQuestionPrompts({
            q1: { 
              prompt: savedPrompts.q1?.prompt || savedPrompts.q1 || defaultQuestionPrompts.q1.prompt, 
              label: savedPrompts.q1?.label || defaultQuestionPrompts.q1.label,
              tooltip: savedPrompts.q1?.tooltip || defaultQuestionPrompts.q1.tooltip,
              includeVocabStandards: savedPrompts.q1?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q1?.includeMainIdeaStandards || false
            },
            q2: { 
              prompt: savedPrompts.q2?.prompt || savedPrompts.q2 || defaultQuestionPrompts.q2.prompt, 
              label: savedPrompts.q2?.label || defaultQuestionPrompts.q2.label,
              tooltip: savedPrompts.q2?.tooltip || defaultQuestionPrompts.q2.tooltip,
              includeVocabStandards: savedPrompts.q2?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q2?.includeMainIdeaStandards || false
            },
            q3: { 
              prompt: savedPrompts.q3?.prompt || savedPrompts.q3 || defaultQuestionPrompts.q3.prompt, 
              label: savedPrompts.q3?.label || defaultQuestionPrompts.q3.label,
              tooltip: savedPrompts.q3?.tooltip || defaultQuestionPrompts.q3.tooltip,
              includeVocabStandards: savedPrompts.q3?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q3?.includeMainIdeaStandards || false
            },
            q4: { 
              prompt: savedPrompts.q4?.prompt || savedPrompts.q4 || defaultQuestionPrompts.q4.prompt, 
              label: savedPrompts.q4?.label || defaultQuestionPrompts.q4.label,
              tooltip: savedPrompts.q4?.tooltip || defaultQuestionPrompts.q4.tooltip,
              includeVocabStandards: savedPrompts.q4?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q4?.includeMainIdeaStandards || false
            },
            q5: { 
              prompt: savedPrompts.q5?.prompt || savedPrompts.q5 || defaultQuestionPrompts.q5.prompt, 
              label: savedPrompts.q5?.label || defaultQuestionPrompts.q5.label,
              tooltip: savedPrompts.q5?.tooltip || defaultQuestionPrompts.q5.tooltip,
              includeVocabStandards: savedPrompts.q5?.includeVocabStandards || false,
              includeMainIdeaStandards: savedPrompts.q5?.includeMainIdeaStandards || false
            }
          });
        } else {
          setQuestionPrompts(defaultQuestionPrompts);
        }
        setSystemInstructions(configData.ai_system_instructions || defaultSystemInstructions);
        setContextInstructions(configData.ai_context_instructions || defaultContextInstructions);
        setFormatRequirements(configData.ai_format_requirements || defaultFormatReqs);
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

      setPrompt(templateData.ai_prompt || `Generate content for the ${field.name} field.`);
      if (templateData.ai_question_prompts) {
        const savedPrompts = templateData.ai_question_prompts;
        setQuestionPrompts({
          q1: { 
            prompt: savedPrompts.q1?.prompt || savedPrompts.q1 || defaultQuestionPrompts.q1.prompt, 
            label: savedPrompts.q1?.label || defaultQuestionPrompts.q1.label,
            tooltip: savedPrompts.q1?.tooltip || defaultQuestionPrompts.q1.tooltip
          },
          q2: { 
            prompt: savedPrompts.q2?.prompt || savedPrompts.q2 || defaultQuestionPrompts.q2.prompt, 
            label: savedPrompts.q2?.label || defaultQuestionPrompts.q2.label,
            tooltip: savedPrompts.q2?.tooltip || defaultQuestionPrompts.q2.tooltip
          },
          q3: { 
            prompt: savedPrompts.q3?.prompt || savedPrompts.q3 || defaultQuestionPrompts.q3.prompt, 
            label: savedPrompts.q3?.label || defaultQuestionPrompts.q3.label,
            tooltip: savedPrompts.q3?.tooltip || defaultQuestionPrompts.q3.tooltip
          },
          q4: { 
            prompt: savedPrompts.q4?.prompt || savedPrompts.q4 || defaultQuestionPrompts.q4.prompt, 
            label: savedPrompts.q4?.label || defaultQuestionPrompts.q4.label,
            tooltip: savedPrompts.q4?.tooltip || defaultQuestionPrompts.q4.tooltip
          },
          q5: { 
            prompt: savedPrompts.q5?.prompt || savedPrompts.q5 || defaultQuestionPrompts.q5.prompt, 
            label: savedPrompts.q5?.label || defaultQuestionPrompts.q5.label,
            tooltip: savedPrompts.q5?.tooltip || defaultQuestionPrompts.q5.tooltip
          }
        });
      } else {
        setQuestionPrompts(defaultQuestionPrompts);
      }
      setSystemInstructions(templateData.ai_system_instructions || defaultSystemInstructions);
      setContextInstructions(templateData.ai_context_instructions || defaultContextInstructions);
      setFormatRequirements(templateData.ai_format_requirements || defaultFormatReqs);
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
      alert('Failed to sync AI configuration from template. Please try again.');
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
      alert('Failed to save AI configuration. Please try again.');
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
            <div style={{
              width: '100%',
              padding: '2rem',
              overflowY: 'auto',
              background: '#fafafa',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center'
            }}>
              <div style={{
                maxWidth: '900px',
                width: '100%',
                background: '#fff',
                border: '2px solid var(--gray-200)',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--gray-700)',
                  marginBottom: '1.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  paddingBottom: '1rem',
                  borderBottom: '2px solid var(--gray-200)'
                }}>
                  Full Prompt Preview
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  fontFamily: 'ui-monospace, monospace',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--gray-700)',
                  lineHeight: '1.8',
                  background: 'var(--gray-50)',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--gray-200)'
                }}>
                  {promptPreview}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{
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
                      <TipTapEditor
                        content={systemInstructions}
                        onChange={(value) => setSystemInstructions(value)}
                        placeholder="e.g., You are an AI assistant..."
                        minHeight="110px"
                        fontSize="0.8125rem"
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
                      <TipTapEditor
                        content={prompt}
                        onChange={(value) => setPrompt(value)}
                        placeholder="Example: Generate..."
                        minHeight="140px"
                        fontSize="0.8125rem"
                      />
                    </div>
                    )}

                    {field?.type === 'mcqs' && (
                      <div style={{
                        marginBottom: '1.5rem',
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: '2px solid #86efac'
                      }}>
                        <label style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#166534',
                          display: 'block',
                          marginBottom: '0.5rem'
                        }}>
                          Question Prompts
                        </label>
                        <p style={{
                          fontSize: '0.75rem',
                          color: '#15803d',
                          marginBottom: '0.75rem',
                          lineHeight: 1.5
                        }}>
                          Each question has its own customizable prompt with a specific focus area. Click each tab to edit its prompt.
                        </p>
                        
                        {/* Question Tabs */}
                        <div style={{
                          display: 'flex',
                          borderBottom: '2px solid #86efac',
                          marginBottom: '1rem',
                          background: '#f0fdf4',
                          borderRadius: '8px 8px 0 0'
                        }}>
                          {questionKeys.map((key, index) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setActiveQuestionTab(index)}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: 'none',
                                background: activeQuestionTab === index ? '#fff' : 'transparent',
                                borderBottom: activeQuestionTab === index ? '3px solid #16a34a' : '3px solid transparent',
                                color: activeQuestionTab === index ? '#166534' : '#15803d',
                                fontWeight: activeQuestionTab === index ? 600 : 400,
                                fontSize: 12,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                marginBottom: '-2px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                            >
                              <span>{`Q${index + 1}`}</span>
                              <span style={{ fontSize: 10, opacity: 0.8 }}>{questionPrompts[key]?.label || ''}</span>
                            </button>
                          ))}
                        </div>
                        
                        {/* Question Prompt Content */}
                        {questionKeys.map((qKey, index) => (
                          <div
                            key={qKey}
                            style={{ display: activeQuestionTab === index ? 'block' : 'none' }}
                          >
                            {/* Label and Tooltip row - only show in template mode */}
                            {mode === 'template' && (
                              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div style={{ flex: 1 }}>
                                  <label style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#166534',
                                    display: 'block',
                                    marginBottom: '0.25rem'
                                  }}>
                                    Tab Label
                                  </label>
                                  <input
                                    type="text"
                                    value={questionPrompts[qKey]?.label || ''}
                                    onChange={(e) => setQuestionPrompts(prev => ({
                                      ...prev,
                                      [qKey]: { ...prev[qKey], label: e.target.value }
                                    }))}
                                    placeholder="e.g., Central Idea"
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem',
                                      border: '2px solid #86efac',
                                      borderRadius: '6px',
                                      fontSize: '0.8125rem',
                                      color: 'var(--gray-900)',
                                      backgroundColor: '#fff',
                                      outline: 'none',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                                <div style={{ flex: 2 }}>
                                  <label style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#166534',
                                    display: 'block',
                                    marginBottom: '0.25rem'
                                  }}>
                                    Tooltip Description
                                  </label>
                                  <input
                                    type="text"
                                    value={questionPrompts[qKey]?.tooltip || ''}
                                    onChange={(e) => setQuestionPrompts(prev => ({
                                      ...prev,
                                      [qKey]: { ...prev[qKey], tooltip: e.target.value }
                                    }))}
                                    placeholder="e.g., Asks about the main idea or central claim"
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem',
                                      border: '2px solid #86efac',
                                      borderRadius: '6px',
                                      fontSize: '0.8125rem',
                                      color: 'var(--gray-900)',
                                      backgroundColor: '#fff',
                                      outline: 'none',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                              </div>
                            )}  
                            
                            {/* Standards Inclusion Checkboxes - Show in template mode always, in lesson mode only if selected */}
                            {(mode === 'template' || (mode === 'lesson' && (questionPrompts[qKey]?.includeVocabStandards || questionPrompts[qKey]?.includeMainIdeaStandards))) && (
                              <div style={{
                                marginBottom: '0.75rem',
                                padding: '0.75rem',
                                background: mode === 'lesson' ? '#f8f9fa' : '#f0fdf4',
                                borderRadius: '8px',
                                border: mode === 'lesson' ? '1px solid #dee2e6' : '1px solid #86efac'
                              }}>
                                <div style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: mode === 'lesson' ? '#495057' : '#166534',
                                  marginBottom: '0.5rem'
                                }}>
                                  Include Grade-Specific Standards {mode === 'lesson' && '(Set by Template)'}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  {(mode === 'template' || questionPrompts[qKey]?.includeVocabStandards) && (
                                    <label style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      cursor: mode === 'lesson' ? 'not-allowed' : 'pointer',
                                      fontSize: '0.8125rem',
                                      color: mode === 'lesson' ? '#495057' : '#15803d'
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={questionPrompts[qKey]?.includeVocabStandards || false}
                                        onChange={(e) => setQuestionPrompts(prev => ({
                                          ...prev,
                                          [qKey]: { ...prev[qKey], includeVocabStandards: e.target.checked }
                                        }))}
                                        disabled={mode === 'lesson'}
                                        style={{ cursor: mode === 'lesson' ? 'not-allowed' : 'pointer' }}
                                      />
                                      <span>Include Vocabulary Standards ({vocabStandards.length > 0 ? vocabStandards.join('; ') : 'None'})</span>
                                    </label>
                                  )}
                                  {(mode === 'template' || questionPrompts[qKey]?.includeMainIdeaStandards) && (
                                    <label style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      cursor: mode === 'lesson' ? 'not-allowed' : 'pointer',
                                      fontSize: '0.8125rem',
                                      color: mode === 'lesson' ? '#495057' : '#15803d'
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={questionPrompts[qKey]?.includeMainIdeaStandards || false}
                                        onChange={(e) => setQuestionPrompts(prev => ({
                                          ...prev,
                                          [qKey]: { ...prev[qKey], includeMainIdeaStandards: e.target.checked }
                                        }))}
                                        disabled={mode === 'lesson'}
                                        style={{ cursor: mode === 'lesson' ? 'not-allowed' : 'pointer' }}
                                      />
                                      <span>Include Main Idea Standards ({mainIdeaStandards.length > 0 ? mainIdeaStandards.join('; ') : 'None'})</span>
                                    </label>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <label style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#166534',
                              display: 'block',
                              marginBottom: '0.25rem'
                            }}>
                              Question {index + 1} Prompt
                            </label>
                            <TipTapEditor
                              content={questionPrompts[qKey]?.prompt || ''}
                              onChange={(value) => setQuestionPrompts(prev => ({
                                ...prev,
                                [qKey]: { ...prev[qKey], prompt: value }
                              }))}
                              placeholder={`Enter the prompt for Question ${index + 1}...`}
                              minHeight="180px"
                              fontSize="0.8125rem"
                            />
                          </div>
                        ))}
                      </div>
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
                      <TipTapEditor
                        content={formatRequirements}
                        onChange={(value) => setFormatRequirements(value)}
                        placeholder="e.g., Return only plain text..."
                        minHeight="100px"
                        fontSize="0.8125rem"
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
                        <TipTapEditor
                          content={contextInstructions}
                          onChange={(value) => setContextInstructions(value)}
                          placeholder="e.g., Use the following context..."
                          minHeight="90px"
                          fontSize="0.8125rem"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {mode === 'lesson' && selectedFields.length > 0 && (
                <div style={{
                  width: '35%',
                  padding: '1.5rem',
                  overflowY: 'auto',
                  background: '#fafafa',
                  borderLeft: '1px solid var(--gray-200)',
                  minHeight: 0
                }}>
                  <div style={{
                    background: '#fff',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '2px solid #fbbf24'
                  }}>
                    <label style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--gray-900)',
                      display: 'block',
                      marginBottom: '0.5rem'
                    }}>
                      Context Fields (Set by Template)
                    </label>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#92400e',
                      marginBottom: '0.75rem',
                      lineHeight: 1.5
                    }}>
                      These fields are used as context for AI generation. They were configured by the template designer.
                    </p>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#059669',
                        marginBottom: '0.5rem'
                      }}>
                        DESIGNER
                      </div>
                      <div style={{
                        border: '2px solid #10b981',
                        borderRadius: '8px',
                        background: '#f0fdf4',
                        padding: '0.75rem'
                      }}>
                        {allFields.filter(f => f.fieldFor === 'designer' && (allowSelfContext || f.id !== field.id) && selectedFields.includes(f.id)).length === 0 ? (
                          <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem', margin: 0 }}>
                            No designer fields
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {allFields.filter(f => f.fieldFor === 'designer' && (allowSelfContext || f.id !== field.id) && selectedFields.includes(f.id)).map(contextField => (
                              <div key={contextField.id} style={{
                                padding: '0.625rem',
                                background: '#d1fae5',
                                borderRadius: '8px',
                                fontSize: '0.8125rem',
                                fontWeight: 500
                              }}>
                                {contextField.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#7c3aed',
                        marginBottom: '0.5rem'
                      }}>
                        BUILDER
                      </div>
                      <div style={{
                        border: '2px solid #7c3aed',
                        borderRadius: '8px',
                        background: '#faf5ff',
                        padding: '0.75rem'
                      }}>
                        {allFields.filter(f => f.fieldFor === 'builder' && (allowSelfContext || f.id !== field.id) && selectedFields.includes(f.id)).length === 0 ? (
                          <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem', margin: 0 }}>
                            No builder fields
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {allFields.filter(f => f.fieldFor === 'builder' && (allowSelfContext || f.id !== field.id) && selectedFields.includes(f.id)).map(contextField => (
                              <div key={contextField.id} style={{
                                padding: '0.625rem',
                                background: '#ede9fe',
                                borderRadius: '8px',
                                fontSize: '0.8125rem',
                                fontWeight: 500
                              }}>
                                {contextField.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'template' && (
                <div style={{
                  width: '35%',
                  padding: '1.5rem',
                  overflowY: 'auto',
                  background: '#fafafa',
                  borderLeft: '1px solid var(--gray-200)',
                  minHeight: 0
                }}>
                  <div style={{
                    background: '#fff',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '2px solid var(--gray-200)'
                  }}>
                    <label style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--gray-900)',
                      display: 'block',
                      marginBottom: '0.5rem'
                    }}>
                      Context Fields
                    </label>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#059669',
                        marginBottom: '0.5rem'
                      }}>
                        DESIGNER
                      </div>
                      <div style={{
                        border: '2px solid #10b981',
                        borderRadius: '8px',
                        background: '#f0fdf4',
                        padding: '0.75rem'
                      }}>
                        {allFields.filter(f => f.fieldFor === 'designer' && (allowSelfContext || f.id !== field.id)).length === 0 ? (
                          <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem', margin: 0 }}>
                            No designer fields
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {allFields.filter(f => f.fieldFor === 'designer' && (allowSelfContext || f.id !== field.id)).map(contextField => (
                              <label key={contextField.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.625rem',
                                background: selectedFields.includes(contextField.id) ? '#d1fae5' : '#fff',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.8125rem'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={selectedFields.includes(contextField.id)}
                                  onChange={() => toggleField(contextField.id)}
                                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                />
                                <span>{contextField.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#7c3aed',
                        marginBottom: '0.5rem'
                      }}>
                        BUILDER
                      </div>
                      <div style={{
                        border: '2px solid #7c3aed',
                        borderRadius: '8px',
                        background: '#faf5ff',
                        padding: '0.75rem'
                      }}>
                        {allFields.filter(f => f.fieldFor === 'builder' && (allowSelfContext || f.id !== field.id)).length === 0 ? (
                          <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem', margin: 0 }}>
                            No builder fields
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {allFields.filter(f => f.fieldFor === 'builder' && (allowSelfContext || f.id !== field.id)).map(contextField => (
                              <label key={contextField.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.625rem',
                                background: selectedFields.includes(contextField.id) ? '#ede9fe' : '#fff',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.8125rem'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={selectedFields.includes(contextField.id)}
                                  onChange={() => toggleField(contextField.id)}
                                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                />
                                <span>{contextField.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--gray-600)',
                      marginTop: '0.75rem',
                      fontWeight: 600,
                      textAlign: 'center'
                    }}>
                      {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--gray-200)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to right, #fafafa, #ffffff)'
        }}>
          <button
            onClick={resetAll}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#ef4444',
              background: '#fff',
              border: '2px solid var(--gray-200)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Reset All
          </button>
          
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
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--gray-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--gray-900)',
                margin: 0
              }}>
                Sync AI Config from Template
              </h2>
              <button
                onClick={() => setShowSyncConfirm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--gray-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <p style={{
                color: 'var(--gray-600)',
                fontSize: '0.95rem',
                marginBottom: '1rem',
                lineHeight: 1.5
              }}>
                This will overwrite the current lesson AI settings for <strong>{field?.name}</strong> with the latest
                template configuration.
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--gray-200)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{
                  fontSize: '0.8125rem',
                  color: 'var(--gray-700)',
                  marginBottom: '0.5rem',
                  fontWeight: 600
                }}>
                  Want a backup first?
                </div>
                <button
                  onClick={downloadCurrentConfig}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--gray-800)',
                    background: '#fff',
                    border: '1px solid var(--gray-300)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Download current config
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowSyncConfirm(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--gray-700)',
                    background: '#fff',
                    border: '1px solid var(--gray-300)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  disabled={syncing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSyncFromTemplate}
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#fff',
                    background: syncing ? '#93c5fd' : '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: syncing ? 'not-allowed' : 'pointer'
                  }}
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Sync now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
