import { useState, useEffect, useRef } from 'react';
import { Save, ArrowLeft, Sparkles, Download, Upload, Eye } from 'lucide-react';
import { marked } from 'marked';
import { sanitizeHTML } from '../../lib/sanitize';
import { useSearchParams, useOutletContext, useNavigate } from 'react-router-dom';
import {
  pageBackground, pageMaxWidth, pageHeaderRelative, backButton, backButtonHover,
  pageTitle, pageSubtitle, stateBadge, toolbarContainer, toolbarRow,
  fieldsCard, requiredFieldIndicator, fieldsLayout,
  loadingContainer, loadingText,
  coverImageContainer, coverImageFull, markdownBody, markdownPreviewCSS,
  gradientButton, liftOnHover,
} from '../../styles/shared';
import AddEditFieldModal from '../modals/AddFieldModal';
import ConfigureAIModal from '../modals/ConfigureAIModal';
import MissingFieldsModal from '../modals/MissingFieldsModal';
import PreFormModal from '../modals/PreFormModal';
import SuccessModal from '../modals/SuccessModal';
import UploadCoverImageModal from '../modals/UploadCoverImageModal';
import UnsavedChangesModal from '../modals/UnsavedChangesModal';
import ConfirmModal from '../modals/ConfirmModal';
import ExportModal from '../modals/ExportModal';
import PreviewModal from '../modals/PreviewModal';
import FieldSection from '../core/FieldSection';
import ModelSelector from '../core/ModelSelector';
import SaveToast from '../core/SaveToast';
import { buildFullPrompt } from '../../ai/promptBuilder';
import { buildFieldResponses } from '../../ai/responseBuilder';
import { APP_CONFIG } from '../../config';
import { supabase } from '../../services/supabaseClient';
import { US_STATES } from '../../config/usStates';
import { callAI, callAIWithFunction, generateImage, generateAltText, summarizePassageForImage } from '../../services/aiClient';
import { getMappedStandardsWithSource, extractGradesFromBand, filterAlignedStandardsWithAI, insertStandardInOrder, getCcssVocabularyStandardsForGrade, getMappedVocabularyStandardsForGrade, getCcssMainIdeaStandardsForGrade, getMappedMainIdeaStandardsForGrade } from '../../lib/standardsMapper';
import { isEmptyValue, validateContextFieldsForField, getMissingRequiredFields } from '../../lib/fieldValueUtils';
import { useToast } from '../../hooks/useToast';
import useLessonLock from '../../hooks/useLessonLock';
import useFieldCRUD from '../../hooks/useFieldCRUD';
import gradeRangeConfig from '../../config/gradeRangeOptions.json';
import themeSelectorConfig from '../../config/themeSelectorOptions.json';
import aiPromptDefaults from '../../config/aiPromptDefaults.json';
import { generateMarkdown as generateAdditionalReadingPracticeMarkdown } from '../../export/templates/additionalreadingpracticeMarkdownExport';
import { generateMarkdown as generateAdditionalReadingPracticeFloridaMarkdown } from '../../export/templates/additionalreadingpracticefloridaMarkdownExport';
export default function CreateNewLesson() {
  const [searchParams] = useSearchParams();
  const { session, profile } = useOutletContext() || {};
  const navigate = useNavigate();
  const toast = useToast();
  
  // Helper function to check if a field is used as context by any AI-enabled field
  const isFieldUsedAsContext = (fieldId) => {
    return fields.some(f => 
      f.aiEnabled && 
      f.ai_context_field_ids && 
      f.ai_context_field_ids.includes(fieldId)
    );
  };
  const templateId = searchParams.get('templateId');
  const urlLessonId = searchParams.get('lessonId');
  const [currentLessonId, setCurrentLessonId] = useState(urlLessonId);
  const lessonId = currentLessonId || urlLessonId;
  const [templateData, setTemplateData] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [fieldValues, setFieldValues] = useState({});
  const [layoutMode, setLayoutMode] = useState('side-by-side'); // 'stacked' or 'side-by-side'
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');

  // AI state for per-field generation
  const [generatingFieldId, setGeneratingFieldId] = useState(null);
  const [aiConfigField, setAIConfigField] = useState(null);
  const [hasGeneratedMap, setHasGeneratedMap] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Lesson generation state
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [generationPaused, setGenerationPaused] = useState(false);
  const [currentGenerationIndex, setCurrentGenerationIndex] = useState(0);
  const [totalGenerationFields, setTotalGenerationFields] = useState(0);
  const [missingFields, setMissingFields] = useState([]);
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  const [highlightedMissingFields, setHighlightedMissingFields] = useState(new Set());
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasInitializedRef = useRef(false);
  const previousFieldValuesRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const autoCreateLessonPromiseRef = useRef(null);
  const generationCancelledRef = useRef(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const handlePreFormClose = async () => {
    setShowPreFormModal(false);
    setPreFormCompleted(true);
    // Trigger generate button animation
    setPulseGenerateButton(true);

    await autoSaveLesson(fieldValues);
  };
  const [exportMarkdown, setExportMarkdown] = useState('');
  const [showUploadCoverImageModal, setShowUploadCoverImageModal] = useState(false);
  const [showPreFormModal, setShowPreFormModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  const [previewCoverImage, setPreviewCoverImage] = useState(null);
  const [missingRequiredFields, setMissingRequiredFields] = useState([]);
  const [preFormCompleted, setPreFormCompleted] = useState(false);
  const [pulseGenerateButton, setPulseGenerateButton] = useState(false);
  const [duplicateContentIdWarning, setDuplicateContentIdWarning] = useState(null);
  const generateButtonRef = useRef(null);
  
  // Lesson lock hook
  const { isLessonLocked, lockOwner, lockOwnerName, acquireLessonLock, releaseLessonLock, refreshLessonLock } = useLessonLock(lessonId, session, profile);

  // Field CRUD hook (add/edit/delete)
  const {
    isModalOpen,
    editingField,
    handleFieldAdded,
    handleEditField,
    handleDeleteField,
    handleModalClose,
  } = useFieldCRUD({
    templateId: templateData?.id,
    fields,
    setFields,
    session,
    toast,
    includeFieldConfig: false,
  });

  // Handler: open AI config modal
  const handleAIConfig = (field) => {
    console.log('🔧 handleAIConfig called with field:', field);
    setAIConfigField(field);
  };

  // Handler: close AI config modal
  const handleAIConfigClose = () => {
    setAIConfigField(null);
  };

  // Handler: navigate back with unsaved changes check
  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesModal(true);
      setPendingNavigation('back');
    } else {
      if (lessonId) {
        setShowSaveToast(true);
        setTimeout(() => {
          setShowSaveToast(false);
          navigate('/browse-lessons');
        }, 1500);
      } else {
        navigate('/browse-lessons');
      }
    }
  };

  // Handler: confirm navigation without saving
  const handleDiscardChanges = () => {
    setShowUnsavedChangesModal(false);
    setHasUnsavedChanges(false);
    if (pendingNavigation === 'back') {
      navigate('/browse-lessons');
    }
    setPendingNavigation(null);
  };

  // Handler: save and then navigate
  const handleSaveAndNavigate = async () => {
    setShowUnsavedChangesModal(false);
    await handleSave();
    if (pendingNavigation === 'back') {
      navigate('/browse-lessons');
    }
    setPendingNavigation(null);
  };

  // Handler: cancel navigation
  const handleCancelNavigation = () => {
    setShowUnsavedChangesModal(false);
    setPendingNavigation(null);
  };

  // Check for missing required fields (field.required = true)
  const checkMissingRequiredFields = (valuesToCheck) => {
    return getMissingRequiredFields(fields, valuesToCheck);
  };

  // Handler: export lesson as markdown
  const handleExportLesson = async () => {
    // Auto-save before exporting
    await handleSave();
    
    // Reload the lesson data from database to ensure we have the most recent data
    let freshFieldValues = fieldValues;
    if (lessonId) {
      try {
        const { data: lesson, error: lessonError } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single();
        
        if (lessonError) {
          console.error('Error reloading lesson data for export:', lessonError);
        } else if (lesson) {
          // Rebuild field values from fresh database data
          freshFieldValues = {};
          fields.forEach(field => {
            if (field.fieldFor === 'designer' && lesson.designer_responses?.[field.id]) {
              freshFieldValues[field.id] = lesson.designer_responses[field.id];
            } else if (field.fieldFor === 'builder' && lesson.builder_responses?.[field.id]) {
              freshFieldValues[field.id] = lesson.builder_responses[field.id];
            }
          });
        }
      } catch (error) {
        console.error('Error fetching fresh lesson data:', error);
      }
    }
    
    // Map template name to markdown export function
    // Template names should be converted to camelCase for function lookup
    const templateNameToFunctionMap = {
      'Additional Reading Practice': generateAdditionalReadingPracticeMarkdown,
      'Additional Reading Practice (Florida)': generateAdditionalReadingPracticeFloridaMarkdown
      // Future templates will be added here manually
    };
    
    const generateFunction = templateNameToFunctionMap[templateData?.name];
    
    if (!generateFunction) {
      console.error('No markdown export function found for template:', templateData?.name);
      toast.error(`No export function found for template "${templateData?.name}". Please contact support.`);
      return;
    }
    
    const markdown = generateFunction(templateData, fields, freshFieldValues);
    setExportMarkdown(markdown);
    
    // Check for missing required fields
    const missing = checkMissingRequiredFields(freshFieldValues);
    setMissingRequiredFields(missing);
    
    setShowExportModal(true);
  };

  // Handler: preview lesson
  const handlePreviewLesson = async () => {
    // Reload the lesson data from database to ensure we have the most recent data
    let freshFieldValues = fieldValues;
    let coverImageUrl = null;
    
    if (lessonId) {
      try {
        const { data: lesson, error: lessonError } = await supabase
          .from('lessons')
          .select('designer_responses, builder_responses, cover_image_url')
          .eq('id', lessonId)
          .single();
        
        if (lessonError) {
          console.error('Error reloading lesson data for preview:', lessonError);
        } else if (lesson) {
          // Rebuild field values from fresh database data
          freshFieldValues = {};
          fields.forEach(field => {
            if (field.fieldFor === 'designer' && lesson.designer_responses?.[field.id]) {
              freshFieldValues[field.id] = lesson.designer_responses[field.id];
            } else if (field.fieldFor === 'builder' && lesson.builder_responses?.[field.id]) {
              freshFieldValues[field.id] = lesson.builder_responses[field.id];
            }
          });
          
          coverImageUrl = lesson.cover_image_url;
        }
      } catch (error) {
        console.error('Error fetching fresh lesson data:', error);
      }
    }
    
    // Map template name to markdown export function
    const templateNameToFunctionMap = {
      'Additional Reading Practice': generateAdditionalReadingPracticeMarkdown,
      'Additional Reading Practice (Florida)': generateAdditionalReadingPracticeFloridaMarkdown
    };
    
    const generateFunction = templateNameToFunctionMap[templateData?.name];
    
    if (!generateFunction) {
      toast.error(`No preview available for template "${templateData?.name}".`);
      return;
    }
    
    let markdown = generateFunction(templateData, fields, freshFieldValues);
    
    // Extract image URL from markdown (look for #Photo Link section)
    let imageUrl = coverImageUrl; // Start with cover image if available
    const photoLinkMatch = markdown.match(/#Photo Link\s*\n\s*([^\s\n]+)/);
    if (photoLinkMatch && photoLinkMatch[1]) {
      imageUrl = photoLinkMatch[1];
      // Remove the Photo Link section from markdown
      markdown = markdown.replace(/#Photo Link\s*\n\s*[^\n]+\n*/g, '');
    }
    
    // Remove Additional Notes section from preview
    markdown = markdown.replace(/#Additional Notes\s*\n[\s\S]*?(?=\n#|\n*$)/g, '');
    
    // Convert single # to ### for h3 headings
    markdown = markdown.replace(/^#([^#\s])/gm, '### $1');
    
    // Convert *word* to bold blue spans (but not **word** which is already bold)
    markdown = markdown.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<span style="font-weight: 600; color: #3b82f6;">$1</span>');
    
    setPreviewMarkdown(markdown);
    setPreviewCoverImage(imageUrl);
    
    // Check for missing required fields
    const missing = checkMissingRequiredFields(freshFieldValues);
    setMissingRequiredFields(missing);
    
    setShowPreviewModal(true);
  };

  // Handler: save AI config - implements snapshot system for lesson-specific configs
  const handleAIConfigSave = async (config, options = {}) => {
    if (!lessonId || !aiConfigField) return;
    
    try {
      // Fetch current lesson data to check if user_ai_config exists
      const { data: lessonData, error: fetchError } = await supabase
        .from('lessons')
        .select('user_ai_config')
        .eq('id', lessonId)
        .single();
      
      if (fetchError) throw fetchError;
      
      let userAIConfig = lessonData?.user_ai_config || {};
      
      // FIRST EDIT: If user_ai_config is empty, snapshot ALL field configs from template
      if (!userAIConfig || Object.keys(userAIConfig).length === 0) {
        console.log('📸 First AI config edit - creating snapshot of all template configs');
        userAIConfig = {};
        
        // Snapshot all fields' AI configs from the template
        for (const field of fields) {
          if (field.aiEnabled) {
            userAIConfig[field.id] = {
              field_name: field.name,
              ai_prompt: field.ai_prompt,
              ai_question_prompts: field.ai_question_prompts,
              ai_context_field_ids: field.ai_context_field_ids,
              ai_system_instructions: field.ai_system_instructions,
              ai_context_instructions: field.ai_context_instructions,
              ai_format_requirements: field.ai_format_requirements
            };
          }
        }
      }
      
      // Update the specific field being edited
      userAIConfig[aiConfigField.id] = {
        field_name: aiConfigField.name,
        ai_prompt: config.prompt,
        ai_question_prompts: config.questionPrompts,
        ai_context_field_ids: config.selectedFieldIds,
        ai_system_instructions: config.systemInstructions,
        ai_context_instructions: config.contextInstructions,
        ai_format_requirements: config.formatRequirements
      };
      
      console.log('💾 Saving user_ai_config to lesson:', userAIConfig);
      
      // Save to lessons.user_ai_config
      const { error: updateError } = await supabase
        .from('lessons')
        .update({ user_ai_config: userAIConfig })
        .eq('id', lessonId);
      
      if (updateError) throw updateError;
      
      console.log('✅ Successfully saved lesson AI config');
      setFields(prevFields => prevFields.map(f => {
        if (f.id !== aiConfigField.id) return f;
        return {
          ...f,
          ai_prompt: config.prompt,
          ai_question_prompts: config.questionPrompts,
          ai_context_field_ids: config.selectedFieldIds,
          ai_system_instructions: config.systemInstructions,
          ai_context_instructions: config.contextInstructions,
          ai_format_requirements: config.formatRequirements
        };
      }));
      if (!options.keepOpen) {
        setAIConfigField(null);
      }
    } catch (error) {
      console.error('Error saving lesson AI config:', error);
      toast.error('Failed to save AI configuration. Please try again.');
    }
  };

  // Handler: generate individual MCQ question
  const handleGenerateIndividualMCQ = async (fieldId, questionIndex, selectedStandard) => {
    console.log('🎯 Generating individual MCQ:', { fieldId, questionIndex, selectedStandard });
    
    try {
      const field = fields.find(f => f.id === fieldId);
      if (!field) throw new Error('Field not found');
      
      // Get AI config for the field
      let fieldAIConfig = null;
      
      // Check if lesson has user_ai_config
      if (lessonId) {
        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('user_ai_config')
          .eq('id', lessonId)
          .single();
        
        if (!lessonError && lessonData?.user_ai_config && lessonData.user_ai_config[field.id]) {
          fieldAIConfig = lessonData.user_ai_config[field.id];
        }
      }
      
      // Fall back to template config
      if (!fieldAIConfig) {
        const { data: fieldData, error } = await supabase
          .from('lesson_template_fields')
          .select('ai_prompt, ai_question_prompts, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
          .eq('id', field.id)
          .single();
        
        if (error) throw new Error('Failed to load AI configuration');
        fieldAIConfig = fieldData;
      }
      
      // Get field values from localStorage
      const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
      
      // Get question-specific prompt based on questionIndex (0-4 -> q1-q5)
      const questionKey = `q${questionIndex + 1}`;
      let questionPrompt;
      
      // Get default question prompts from aiPromptDefaults.json
      const defaultQuestionPrompts = aiPromptDefaults.fieldTypePrompts?.mcqs?.questionPrompts || {};
      
      // Check for question-specific prompt in ai_question_prompts, fall back to defaults
      // Handle both old format (string) and new format (object with prompt property)
      if (fieldAIConfig.ai_question_prompts && fieldAIConfig.ai_question_prompts[questionKey]) {
        const saved = fieldAIConfig.ai_question_prompts[questionKey];
        questionPrompt = typeof saved === 'string' ? saved : saved.prompt;
      } else if (defaultQuestionPrompts[questionKey]) {
        // Fall back to default prompt for this specific question
        const defaultQ = defaultQuestionPrompts[questionKey];
        questionPrompt = typeof defaultQ === 'string' ? defaultQ : defaultQ.prompt;
        console.log(`📋 Using default prompt for ${questionKey}`);
      } else {
        // Last resort: modify main prompt for single question
        questionPrompt = fieldAIConfig.ai_prompt?.replace(/Generate 5 multiple choice questions/gi, 'Generate 1 multiple choice question') || 'Generate 1 multiple choice question';
      }
      
      // Get MCQ-specific format requirements, falling back to defaults
      const mcqFormatRequirements = fieldAIConfig.ai_format_requirements || 
        aiPromptDefaults.formatRequirements?.mcqs || 
        '';
      
      // Log context field configuration for debugging
      console.log('🔧 AI Config context fields:', fieldAIConfig.ai_context_field_ids);
      console.log('🔧 Available field values keys:', Object.keys(storedFieldValues));
      
      // Build prompt for single question
      const aiConfig = {
        systemInstructions: fieldAIConfig.ai_system_instructions || '',
        prompt: questionPrompt,
        formatRequirements: mcqFormatRequirements,
        contextInstructions: fieldAIConfig.ai_context_instructions || '',
        selectedFieldIds: fieldAIConfig.ai_context_field_ids || [],
        allFields: fields,
        fieldValues: storedFieldValues
      };
      
      // Warn if no context fields are configured
      if (!fieldAIConfig.ai_context_field_ids || fieldAIConfig.ai_context_field_ids.length === 0) {
        console.warn('⚠️ No context fields configured for MCQ generation - AI may not have passage content');
      }

      // Check if this question should include vocab and/or main idea standards
      const questionConfig = fieldAIConfig.ai_question_prompts?.[questionKey];
      const includeVocabStandards = questionConfig?.includeVocabStandards || false;
      const includeMainIdeaStandards = questionConfig?.includeMainIdeaStandards || false;

      // Add grade-specific standards context based on checkboxes
      const defaultFramework = templateData?.default_standard_framework || 'CCSS';
      const gradeField = fields.find(f => f.type === 'grade_band_selector');
      const gradeValue = gradeField ? storedFieldValues[gradeField.id] : null;
      const gradeLevels = extractGradesFromBand(gradeValue);
      
      const extraContextBlocks = [];
      
      if (includeVocabStandards) {
        const vocabStandards = defaultFramework === 'CCSS'
          ? await getCcssVocabularyStandardsForGrade(gradeLevels)
          : await getMappedVocabularyStandardsForGrade(gradeLevels, defaultFramework);
        
        if (vocabStandards.length > 0) {
          extraContextBlocks.push({
            title: `Grade-Specific Vocabulary Standards (${defaultFramework})`,
            content: vocabStandards.join('; ')
          });
          console.log('📚 Vocab standards added to MCQ prompt (individual):', vocabStandards);
        }
      }
      
      if (includeMainIdeaStandards) {
        const mainIdeaStandards = defaultFramework === 'CCSS'
          ? await getCcssMainIdeaStandardsForGrade(gradeLevels)
          : await getMappedMainIdeaStandardsForGrade(gradeLevels, defaultFramework);
        
        if (mainIdeaStandards.length > 0) {
          extraContextBlocks.push({
            title: `Grade-Specific Main Idea Standards (${defaultFramework})`,
            content: mainIdeaStandards.join('; ')
          });
          console.log('📚 Main Idea standards added to MCQ prompt (individual):', mainIdeaStandards);
        }
      }
      
      if (extraContextBlocks.length > 0) {
        aiConfig.extraContextBlocks = extraContextBlocks;
      }
      
      // Add selected standard to context if provided
      if (selectedStandard) {
        aiConfig.prompt += `\n\nUSE THIS STANDARD AS GUIDANCE:\nStandard Code: ${selectedStandard.fullCode}\nStandard Statement: ${selectedStandard.statement}\n\nCreate a question that aligns with and addresses this standard.`;
      }
      
      const prompt = buildFullPrompt(aiConfig);
      console.log('📝 Individual MCQ prompt:', prompt);
      
      // Use function calling for structured MCQ output
      const functionSchema = {
        name: 'generate_mcqs',
        description: 'Generate 1 multiple choice question with answer choices, standards, and answer key',
        parameters: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question_text: { type: 'string', description: 'The question text' },
                  choices: {
                    type: 'object',
                    properties: {
                      A: { type: 'string' },
                      B: { type: 'string' },
                      C: { type: 'string' },
                      D: { type: 'string' }
                    },
                    required: ['A', 'B', 'C', 'D']
                  },
                  standards: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of relevant standards for this question'
                  },
                  correct_answer: {
                    type: 'string',
                    enum: ['A', 'B', 'C', 'D'],
                    description: 'The letter of the correct answer'
                  }
                },
                required: ['question_text', 'choices', 'standards', 'correct_answer']
              },
              minItems: 1,
              maxItems: 1
            }
          },
          required: ['questions']
        }
      };
      
      const result = await callAIWithFunction(prompt, selectedModel, functionSchema);
      console.log('✅ Individual MCQ generated (structured):', result);
      
      // Validate the response structure
      if (!result || !result.questions || !result.questions[0]) {
        throw new Error('AI returned invalid response structure');
      }
      
      // Format the structured response as HTML for TipTap
      const q = result.questions[0];
      
      // Validate question has required content
      if (!q.question_text || !q.choices || !q.choices.A || !q.choices.B || !q.choices.C || !q.choices.D) {
        console.error('❌ Invalid MCQ response:', q);
        throw new Error('AI generated incomplete question - missing question text or choices. Check that context fields (passage) are configured in AI Config.');
      }
      
      // Build context text from configured context fields (e.g., reading passage)
      let contextText = '';
      if (fieldAIConfig.ai_context_field_ids && fieldAIConfig.ai_context_field_ids.length > 0) {
        const contextParts = [];
        for (const contextFieldId of fieldAIConfig.ai_context_field_ids) {
          const contextField = fields.find(f => f.id === contextFieldId);
          const contextValue = storedFieldValues[contextFieldId];
          if (contextField && contextValue) {
            const displayVal = typeof contextValue === 'string' 
              ? contextValue 
              : (contextValue.text || contextValue.value || JSON.stringify(contextValue));
            // Strip HTML tags for cleaner context
            const cleanVal = displayVal.replace(/<[^>]*>/g, '').trim();
            if (cleanVal) {
              contextParts.push(`${contextField.name}:\n${cleanVal}`);
            }
          }
        }
        contextText = contextParts.join('\n\n');
      }
      
      // Map standards - either from selected standard or from AI-generated standards
      let standardsText = q.standards.join('; ');
      let sourceStandardInfo = null;
      let candidateStandards = [];
      
      // First check if user selected a specific standard to use
      if (selectedStandard && selectedStandard.fullCode) {
        const mappingResult = await getMappedStandardsWithSource(selectedStandard.fullCode, gradeLevels);
        standardsText = mappingResult.mappedStandards || standardsText;
        sourceStandardInfo = mappingResult.sourceStandard;
        
        // Get candidate standards for filtering (excluding source standard)
        candidateStandards = standardsText
          .split(';')
          .map(s => s.trim())
          .filter(s => s && s !== mappingResult.sourceStandard?.code);
      } 
      // Otherwise map the AI-generated standards (works for any framework)
      else if (q.standards && q.standards.length > 0) {
        const firstStandard = q.standards[0];
        const mappingResult = await getMappedStandardsWithSource(firstStandard, gradeLevels);
        standardsText = mappingResult.mappedStandards || standardsText;
        sourceStandardInfo = mappingResult.sourceStandard;
        
        // Get candidate standards for filtering (excluding source standard)
        candidateStandards = standardsText
          .split(';')
          .map(s => s.trim())
          .filter(s => s && s !== mappingResult.sourceStandard?.code);
      }
      
      // Filter aligned standards using AI if we have context and candidates
      let filteredOutForQuestion = [];
      if (contextText && candidateStandards.length > 0) {
        console.log(`🔍 Filtering ${candidateStandards.length} aligned standards for individual question...`);
        const questionText = `${q.question_text}\nA. ${q.choices.A}\nB. ${q.choices.B}\nC. ${q.choices.C}\nD. ${q.choices.D}`;
        const filteredStandards = await filterAlignedStandardsWithAI(
          questionText,
          contextText,
          candidateStandards,
          callAI,
          selectedModel
        );
        console.log(`✅ Filtered to ${filteredStandards.length} standards`);
        
        // Track which standards were filtered out
        filteredOutForQuestion = candidateStandards.filter(s => !filteredStandards.includes(s));
        standardsText = filteredStandards.join('; ');
      }
      
      // Insert source standard in its proper framework position (CCSS; TEKS; BEST; BLOOM; GSE order)
      if (sourceStandardInfo && sourceStandardInfo.code) {
        standardsText = insertStandardInOrder(standardsText, sourceStandardInfo.code);
      }
      
      const questionNumber = questionIndex + 1;
      const formattedMCQ = `<p>${questionNumber}. ${q.question_text}<br>A. ${q.choices.A}<br>B. ${q.choices.B}<br>C. ${q.choices.C}<br>D. ${q.choices.D}<br>[${standardsText}]<br>KEY: ${q.correct_answer}</p>`;
      
      // Build updated questions array and source standards
      const currentValue = fieldValues[fieldId] || { questions: ['', '', '', '', ''], sourceStandards: {}, filteredOutStandards: {} };
      const updatedQuestions = [...(currentValue.questions || ['', '', '', '', ''])];
      updatedQuestions[questionIndex] = formattedMCQ;
      
      // Track source standard for this question
      const updatedSourceStandards = { ...(currentValue.sourceStandards || {}) };
      if (sourceStandardInfo) {
        updatedSourceStandards[questionIndex] = sourceStandardInfo;
      }
      
      // Track filtered-out standards for this question
      const updatedFilteredOutStandards = { ...(currentValue.filteredOutStandards || {}) };
      updatedFilteredOutStandards[questionIndex] = filteredOutForQuestion;
      
      const newFieldValue = { 
        questions: updatedQuestions,
        sourceStandards: updatedSourceStandards,
        filteredOutStandards: updatedFilteredOutStandards,
        standards: currentValue.standards || {}
      };
      
      // Update state
      setFieldValues(prev => ({
        ...prev,
        [fieldId]: newFieldValue
      }));
      
      setHasGeneratedMap(prev => ({ ...prev, [fieldId]: true }));
    } catch (error) {
      console.error('Error generating individual MCQ:', error);
      toast.error(`Failed to generate question: ${error.message}`);
    }
  };

  // Handler: Generate entire lesson (all AI-enabled fields)
  const handleGenerateLesson = async () => {
    generationCancelledRef.current = false;
    // If paused, continue from where we left off
    if (generationPaused) {
      setGenerationPaused(false);
      setShowMissingFieldsModal(false);
      setHighlightedMissingFields(new Set());
      
      // Re-validate and continue
      await continueGeneration();
      return;
    }

    // Start fresh generation
    // Get all AI-enabled fields in order: designer first, then builder
    const aiEnabledDesignerFields = fields.filter(f => f.fieldFor === 'designer' && f.aiEnabled);
    const aiEnabledBuilderFields = fields.filter(f => f.fieldFor === 'builder' && f.aiEnabled);
    const allAIFields = [...aiEnabledDesignerFields, ...aiEnabledBuilderFields];

    // Upfront: validate context fields for ALL AI-enabled fields
    const allMissing = [];
    const missingIds = new Set();
    for (const field of allAIFields) {
      const missing = validateContextFieldsForField(field, fields, fieldValues);
      for (const m of missing) {
        if (!missingIds.has(m.id)) {
          missingIds.add(m.id);
          allMissing.push(m);
        }
      }
    }
    if (allMissing.length > 0) {
      setMissingFields(allMissing);
      setShowMissingFieldsModal(true);
      setHighlightedMissingFields(new Set(allMissing.map(m => m.id)));
      return;
    }

    setIsGeneratingLesson(true);
    setGenerationPaused(false);
    setCurrentGenerationIndex(0);
    setHighlightedMissingFields(new Set());
    setTotalGenerationFields(allAIFields.length);
    
    // Generate all fields
    await continueGeneration();
  };

  const handleStopGeneration = () => {
    generationCancelledRef.current = true;
    setIsGeneratingLesson(false);
    setGenerationPaused(true);
    setShowMissingFieldsModal(false);
    setHighlightedMissingFields(new Set());
  };

  const continueGeneration = async () => {
    generationCancelledRef.current = false;
    const aiEnabledDesignerFields = fields.filter(f => f.fieldFor === 'designer' && f.aiEnabled);
    const aiEnabledBuilderFields = fields.filter(f => f.fieldFor === 'builder' && f.aiEnabled);
    const allAIFields = [...aiEnabledDesignerFields, ...aiEnabledBuilderFields];
    
    // Track updated values as we generate each field
    let currentFieldValues = { ...fieldValues };
    
    for (let i = currentGenerationIndex; i < allAIFields.length; i++) {
      if (generationCancelledRef.current) {
        setIsGeneratingLesson(false);
        setGenerationPaused(true);
        return;
      }
      const field = allAIFields[i];
      setCurrentGenerationIndex(i);
      
      // Generate the field
      try {
        const generatedValue = await handleGenerateAI(field, currentFieldValues);
        if (generatedValue?.blocked) {
          setIsGeneratingLesson(false);
          return;
        }
        
        // Update our tracking with the newly generated value
        currentFieldValues = { ...currentFieldValues, [field.id]: generatedValue };

        // Ensure Supabase save completes before moving to next field
        await autoSaveLesson(currentFieldValues);
      } catch (error) {
        console.error(`Error generating field ${field.name}:`, error);
        toast.error(`Failed to generate "${field.name}": ${error.message}\n\nGeneration paused.`);
        setIsGeneratingLesson(false);
        setGenerationPaused(true);
        return;
      }
    }
    
    // All done!
    setIsGeneratingLesson(false);
    setGenerationPaused(false);
    setCurrentGenerationIndex(0);
    setShowSuccessModal(true);
  };

  // Auto-save lesson after field generation
  const autoSaveLesson = async (updatedFieldValues = null) => {
    if (!templateData?.id) return;
    
    // Use provided values or fall back to state
    const valuesToSave = updatedFieldValues || fieldValues;
    
    try {
      const { designerResponses, builderResponses } = buildFieldResponses(fields, valuesToSave, { keyBy: 'id' });

      console.log('💾 Auto-save: Final designer responses:', designerResponses);
      console.log('💾 Auto-save: Final builder responses:', builderResponses);

      let effectiveLessonId = lessonId;

      if (!effectiveLessonId) {
        if (!autoCreateLessonPromiseRef.current) {
          console.log('💾 Auto-save: No lesson ID, creating new lesson...');
          autoCreateLessonPromiseRef.current = (async () => {
            // Check for duplicate Content ID before first create
            const contentIdField = fields.find(f => f.name === 'Content ID' && f.fieldFor === 'designer');
            const contentIdValue = contentIdField ? valuesToSave[contentIdField.id] : null;
            if (contentIdValue?.trim()) {
              const duplicate = await checkDuplicateContentId(contentIdValue);
              if (duplicate) {
                toast.warning(`Duplicate Content ID "${duplicate.contentId}" — another lesson ("${duplicate.template_name || 'Unknown'}") already uses this ID. Please change it before saving.`);
                return null;
              }
            }

            const { data: newLesson, error: insertError } = await supabase
              .from('lessons')
              .insert({
                lesson_template_id: templateData.id,
                template_name: templateData.name,
                created_by: session?.user?.id,
                designer_responses: designerResponses,
                builder_responses: builderResponses,
                status: 'draft',
                is_test: false,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            if (insertError) {
              console.error('❌ Auto-save insert error:', insertError);
              throw insertError;
            }

            console.log('✅ Auto-save created new lesson:', newLesson.id);
            setCurrentLessonId(newLesson.id);

            const newUrl = `${window.location.pathname}?templateId=${templateData.id}&lessonId=${newLesson.id}`;
            window.history.replaceState({}, '', newUrl);

            return newLesson.id;
          })();
        }

        try {
          effectiveLessonId = await autoCreateLessonPromiseRef.current;
        } finally {
          autoCreateLessonPromiseRef.current = null;
        }

        // If duplicate was found, abort auto-save
        if (!effectiveLessonId) return;
      }

      const { error } = await supabase
        .from('lessons')
        .update({
          designer_responses: designerResponses,
          builder_responses: builderResponses,
          template_name: templateData.name
        })
        .eq('id', effectiveLessonId);
      
      if (error) {
        console.error('❌ Auto-save error:', error);
        throw new Error(`Failed to auto-save: ${error.message}`);
      }
      
      console.log('✅ Auto-saved successfully');
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error auto-saving:', error);
      // Don't re-throw for auto-save - just log the error
      console.error('Auto-save failed, but continuing...');
    }
  };

  // Handler: trigger AI generation
  const handleGenerateAI = async (field, valuesOverride = null) => {
    try {
      setGeneratingFieldId(field.id);

      const missingContext = validateContextFieldsForField(field, fields, valuesOverride || fieldValues);
      if (missingContext.length > 0) {
        setMissingFields(missingContext);
        setShowMissingFieldsModal(true);
        setGenerationPaused(true);
        setHighlightedMissingFields(new Set(missingContext.map(m => m.id)));
        setGeneratingFieldId(null);
        return { blocked: true };
      }
      
      // Handle image fields with AI config
      if (field.type === 'image') {
        console.log('🖼️ Generating image for field:', field.id);
        
        let fieldAIConfig = null;
        
        // Check if lesson has user_ai_config (lesson-specific overrides)
        if (lessonId) {
          console.log('🔍 Checking for lesson-specific AI config');
          const { data: lessonData, error: lessonError } = await supabase
            .from('lessons')
            .select('user_ai_config')
            .eq('id', lessonId)
            .single();
          
          if (!lessonError && lessonData?.user_ai_config && lessonData.user_ai_config[field.id]) {
            console.log('✅ Using lesson-specific AI config for image field:', field.id);
            fieldAIConfig = lessonData.user_ai_config[field.id];
          }
        }
        
        // Fall back to template config if no lesson-specific config
        if (!fieldAIConfig) {
          console.log('📥 Fetching template AI config from Supabase for image field:', field.id);
          const { data: fieldData, error } = await supabase
            .from('lesson_template_fields')
            .select('ai_prompt, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
            .eq('id', field.id)
            .single();
          
          if (error) {
            console.error('Error fetching AI config:', error);
            throw new Error('Failed to load AI configuration');
          }
          
          console.log('✅ Using template AI config for image:', fieldData);
          fieldAIConfig = fieldData;
        }
        
        // Read field values from localStorage
        const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
        
        // Build prompt using the AI config
        const aiConfig = {
          systemInstructions: fieldAIConfig.ai_system_instructions || '',
          prompt: fieldAIConfig.ai_prompt || '',
          formatRequirements: fieldAIConfig.ai_format_requirements || '',
          contextInstructions: fieldAIConfig.ai_context_instructions || '',
          selectedFieldIds: fieldAIConfig.ai_context_field_ids || [],
          allFields: fields,
          fieldValues: storedFieldValues
        };

        // For images, we want a cleaner prompt focused on visual description
        // If the user provided a description, use that as the primary prompt
        const currentFieldValue = storedFieldValues[field.id];
        let imagePrompt = '';
        
        if (currentFieldValue && currentFieldValue.description && currentFieldValue.description.trim()) {
          imagePrompt = currentFieldValue.description.trim();
          console.log('✏️ Using user-provided image description as primary prompt');
        } else {
          // Otherwise use the template's AI prompt
          imagePrompt = fieldAIConfig.ai_prompt || 'A high-quality photographic image.';
        }
        
        // Add context from other fields if specified, but format it for an image generator
        let passageText = '';
        if (fieldAIConfig.ai_context_field_ids && fieldAIConfig.ai_context_field_ids.length > 0) {
          let contextDetails = [];
          fieldAIConfig.ai_context_field_ids.forEach(id => {
            const contextField = fields.find(f => f.id === id);
            const val = storedFieldValues[id];
            if (contextField && val) {
              const displayVal = typeof val === 'string' ? val : (val.text || val.value || JSON.stringify(val));
              // Strip HTML for the image generator
              const cleanValFull = displayVal.replace(/<[^>]*>/g, '').trim();
              const cleanVal = cleanValFull.length > 500 ? `${cleanValFull.substring(0, 500)}...` : cleanValFull;
              contextDetails.push(`${contextField.name}: ${cleanVal}`);

              if (!passageText && /passage/i.test(contextField.name)) {
                passageText = cleanValFull;
              }
            }
          });
          
          if (contextDetails.length > 0) {
            imagePrompt += `\n\nSubject matter context:\n${contextDetails.join('\n')}`;
          }
        }

        if (passageText) {
          console.log('📝 Summarizing passage for image guidance...');
          const passageSummary = await summarizePassageForImage(passageText, 700);
          if (passageSummary) {
            imagePrompt = `Passage summary for cover image (<=700 chars):\n${passageSummary}\n\n${imagePrompt}`;
          }
        }
        
        // Add system instructions if they exist and aren't just the default text one
        if (fieldAIConfig.ai_system_instructions && !fieldAIConfig.ai_system_instructions.includes('clear, concise')) {
          imagePrompt = `${fieldAIConfig.ai_system_instructions}\n\n${imagePrompt}`;
        }
        
        console.log('🎨 Image generation prompt:', imagePrompt);
        
        // Generate the image
        const { url: imageDataUrl, model: usedModel, altText: geminiAltText } = await generateImage(imagePrompt, '1024x1024');
        console.log('✅ Image generated with model:', usedModel);
        
        // Generate alt text - use Gemini's if available, otherwise use GPT-4o Vision
        let generatedAltText = geminiAltText;
        let altTextModel = usedModel;
        
        if (!generatedAltText) {
          console.log('📝 Generating alt text with GPT-4o Vision');
          generatedAltText = await generateAltText(imageDataUrl);
          altTextModel = 'gpt-4o';
          console.log('✅ Alt text generated:', generatedAltText);
        } else {
          console.log('✅ Using Gemini alt text:', generatedAltText);
        }
        
        // Upload to Supabase Storage
        console.log('☁️ Uploading image to Supabase Storage...');
        
        // Find Content ID field in designer responses
        const contentIdField = fields.find(f => f.name === 'Content ID' && f.fieldFor === 'designer');
        const rawContentId = contentIdField ? storedFieldValues[contentIdField.id] : null;
        
        if (!rawContentId) {
          throw new Error('Content ID field not found. Please fill in the Content ID field first.');
        }

        // Sanitize the Content ID for use as a storage filename:
        // Strip HTML, keep only alphanumeric/underscore/hyphen/dot, truncate to 120 chars
        const contentId = rawContentId
          .replace(/<[^>]*>/g, '')
          .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .substring(0, 120);

        if (!contentId) {
          throw new Error('Content ID is empty after sanitization. Please enter a valid Content ID.');
        }
        
        // Get template name
        const { data: templateData } = await supabase
          .from('lesson_templates')
          .select('name')
          .eq('id', templateId)
          .single();
        
        const templateName = templateData?.name || 'unknown-template';
        const fileName = `${templateName}/${contentId}.png`;
        
        // Convert base64 to blob
        const base64Data = imageDataUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        console.log('🗑️ Removing old image:', fileName);
        // Force delete old image - don't continue until delete completes
        await supabase.storage
          .from('lesson-images')
          .remove([fileName]);
        
        // Wait a moment to ensure delete propagates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('☁️ Uploading new image:', fileName, 'Size:', blob.size, 'bytes');
        // Upload new image (without upsert since we just deleted)
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('lesson-images')
          .upload(fileName, blob, {
            contentType: 'image/png',
            cacheControl: '0'
          });
        
        if (uploadError) {
          console.error('❌ Upload error:', uploadError);
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }
        
        console.log('✅ Upload successful:', uploadData);
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('lesson-images')
          .getPublicUrl(fileName);
        
        // Add cache-busting timestamp to force browser to reload new image
        const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
        
        console.log('✅ Image uploaded to:', cacheBustedUrl);
        
        // Update the field value with public URL and metadata
        const imageFieldValue = {
          url: cacheBustedUrl,
          altText: generatedAltText,
          imageModel: usedModel,
          altTextModel: altTextModel,
          description: currentFieldValue?.description || ''
        };
        
        console.log('📦 Setting image field value:', imageFieldValue);
        
        setFieldValues(prev => {
          const newValues = { 
            ...prev, 
            [field.id]: imageFieldValue
          };
          console.log('📦 New fieldValues state:', newValues);
          return newValues;
        });
        setHasGeneratedMap(prev => ({ ...prev, [field.id]: true }));
        
        // Auto-save to database after image generation
        console.log('💾 Auto-saving lesson after image generation...');
        if (lessonId) {
          const designerFields = fields.filter(f => f.fieldFor === 'designer');
          const builderFields = fields.filter(f => f.fieldFor === 'builder');
          
          const updatedFieldValues = { ...storedFieldValues, [field.id]: imageFieldValue };
          
          const designResponses = {};
          designerFields.forEach(f => {
            const value = updatedFieldValues[f.id];
            if (f.type === 'checklist') {
              designResponses[f.name] = Array.isArray(value) ? value : [];
            } else if (f.type === 'image') {
              designResponses[f.name] = value || { url: '', altText: '', description: '', imageModel: '', altTextModel: '' };
            } else {
              designResponses[f.name] = value || f.placeholder || '';
            }
          });
          
          const lessonResponses = {};
          builderFields.forEach(f => {
            const value = updatedFieldValues[f.id];
            if (f.type === 'checklist') {
              lessonResponses[f.name] = Array.isArray(value) ? value : [];
            } else if (f.type === 'image') {
              lessonResponses[f.name] = value || { url: '', altText: '', description: '', imageModel: '', altTextModel: '' };
            } else {
              lessonResponses[f.name] = value || f.placeholder || '';
            }
          });
          
          await supabase
            .from('lessons')
            .update({
              designer_responses: designResponses,
              builder_responses: lessonResponses
            })
            .eq('id', lessonId);
          
          console.log('✅ Lesson auto-saved');
        }
        
        console.log('✅ Image generation complete');
        setGeneratingFieldId(null);
        return;
      }
      
      let fieldAIConfig = null;
      
      // Check if lesson has user_ai_config (lesson-specific overrides)
      if (lessonId) {
        console.log('🔍 Checking for lesson-specific AI config');
        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('user_ai_config')
          .eq('id', lessonId)
          .single();
        
        if (!lessonError && lessonData?.user_ai_config && lessonData.user_ai_config[field.id]) {
          console.log('✅ Using lesson-specific AI config for field:', field.id);
          fieldAIConfig = lessonData.user_ai_config[field.id];
        }
      }
      
      // Fall back to template config if no lesson-specific config
      if (!fieldAIConfig) {
        console.log('📥 Fetching template AI config from Supabase for field:', field.id);
        const { data: fieldData, error } = await supabase
          .from('lesson_template_fields')
          .select('ai_prompt, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
          .eq('id', field.id)
          .single();
        
        if (error) {
          console.error('Error fetching AI config:', error);
          throw new Error('Failed to load AI configuration');
        }
        
        console.log('✅ Using template AI config:', fieldData);
        fieldAIConfig = fieldData;
      }
      
      // Read field values from localStorage (same as ConfigureAIModal preview)
      const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
      
      // Build prompt using the AI config (either lesson-specific or template)
      const aiConfig = {
        systemInstructions: fieldAIConfig.ai_system_instructions || '',
        prompt: fieldAIConfig.ai_prompt || '',
        formatRequirements: fieldAIConfig.ai_format_requirements || '',
        contextInstructions: fieldAIConfig.ai_context_instructions || '',
        selectedFieldIds: fieldAIConfig.ai_context_field_ids || [],
        allFields: fields,
        fieldValues: storedFieldValues
      };

      // Build the prompt using the shared function
      const prompt = buildFullPrompt(aiConfig);

      console.log('Generating with model:', selectedModel);
      console.log('Prompt:\n', prompt);

      // Check if this is an MCQs field to use function calling
      let generatedContent;
      
      if (field.type === 'mcqs') {
        console.log('🎯 Generating MCQs sequentially using question prompts');
        
        // Generate each question sequentially using individual question prompts
        const formattedQuestions = [];
        const sourceStandards = {};
        const filteredOutStandards = {};
        
        // Get question-specific prompts from AI config or defaults
        const defaultQuestionPrompts = aiPromptDefaults.fieldTypePrompts?.mcqs?.questionPrompts || {};
        
        // Fetch ai_question_prompts from database if not in fieldAIConfig
        let questionPromptsConfig = fieldAIConfig.ai_question_prompts;
        if (!questionPromptsConfig) {
          const { data: fieldData } = await supabase
            .from('lesson_template_fields')
            .select('ai_question_prompts')
            .eq('id', field.id)
            .single();
          questionPromptsConfig = fieldData?.ai_question_prompts;
        }
        
        // Extract grade level from fieldValues
        const gradeField = fields.find(f => f.type === 'grade_band_selector');
        const gradeValue = gradeField ? storedFieldValues[gradeField.id] : null;
        const gradeLevels = extractGradesFromBand(gradeValue);

        // Resolve default vocab standards when using CCSS
        const defaultFramework = templateData?.default_standard_framework || 'CCSS';
        const vocabStandards = defaultFramework === 'CCSS'
          ? await getCcssVocabularyStandardsForGrade(gradeLevels)
          : await getMappedVocabularyStandardsForGrade(gradeLevels, defaultFramework);
        if (vocabStandards.length > 0) {
          console.log('📚 Vocab standards added to MCQ prompts (sequential):', vocabStandards);
        }
        
        // Build context text from configured context fields (e.g., reading passage)
        let contextText = '';
        if (fieldAIConfig.ai_context_field_ids && fieldAIConfig.ai_context_field_ids.length > 0) {
          const contextParts = [];
          for (const contextFieldId of fieldAIConfig.ai_context_field_ids) {
            const contextField = fields.find(f => f.id === contextFieldId);
            const contextValue = storedFieldValues[contextFieldId];
            if (contextField && contextValue) {
              const displayVal = typeof contextValue === 'string' 
                ? contextValue 
                : (contextValue.text || contextValue.value || JSON.stringify(contextValue));
              // Strip HTML tags for cleaner context
              const cleanVal = displayVal.replace(/<[^>]*>/g, '').trim();
              if (cleanVal) {
                contextParts.push(`${contextField.name}:\n${cleanVal}`);
              }
            }
          }
          contextText = contextParts.join('\n\n');
        }
        
        // Function schema for single MCQ
        const functionSchema = aiPromptDefaults.fieldTypePrompts?.mcqs?.functionCallingSingle || {
          name: 'generate_mcq',
          description: 'Generate 1 multiple choice question with answer choices, standards, and answer key',
          parameters: {
            type: 'object',
            properties: {
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    question_text: { type: 'string', description: 'The question text' },
                    choices: {
                      type: 'object',
                      properties: {
                        A: { type: 'string' },
                        B: { type: 'string' },
                        C: { type: 'string' },
                        D: { type: 'string' }
                      },
                      required: ['A', 'B', 'C', 'D']
                    },
                    standards: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'List of relevant standards for this question'
                    },
                    correct_answer: {
                      type: 'string',
                      enum: ['A', 'B', 'C', 'D'],
                      description: 'The letter of the correct answer'
                    }
                  },
                  required: ['question_text', 'choices', 'standards', 'correct_answer']
                },
                minItems: 1,
                maxItems: 1
              }
            },
            required: ['questions']
          }
        };
        
        // Generate each question sequentially (q1, q2, q3, q4, q5)
        for (let i = 0; i < 5; i++) {
          const questionKey = `q${i + 1}`;
          console.log(`📝 Generating question ${i + 1} (${questionKey})...`);
          
          // Get question-specific prompt
          let questionPrompt;
          if (questionPromptsConfig && questionPromptsConfig[questionKey]) {
            const saved = questionPromptsConfig[questionKey];
            questionPrompt = typeof saved === 'string' ? saved : saved.prompt;
          } else if (defaultQuestionPrompts[questionKey]) {
            const defaultQ = defaultQuestionPrompts[questionKey];
            questionPrompt = typeof defaultQ === 'string' ? defaultQ : defaultQ.prompt;
            console.log(`📋 Using default prompt for ${questionKey}`);
          } else {
            questionPrompt = 'Generate 1 multiple choice question based on the passage.';
          }
          
          // Build prompt for this specific question
          const questionAIConfig = {
            systemInstructions: fieldAIConfig.ai_system_instructions || '',
            prompt: questionPrompt,
            formatRequirements: fieldAIConfig.ai_format_requirements || aiPromptDefaults.formatRequirements?.mcqs || '',
            contextInstructions: fieldAIConfig.ai_context_instructions || '',
            selectedFieldIds: fieldAIConfig.ai_context_field_ids || [],
            allFields: fields,
            fieldValues: storedFieldValues
          };

          if (vocabStandards.length > 0) {
            questionAIConfig.extraContextBlocks = [
              {
                title: 'Grade-Specific Vocabulary Standards (CCSS)',
                content: vocabStandards.join('; ')
              }
            ];
          }

          if (vocabStandards.length > 0) {
            questionAIConfig.prompt += `\n\nALIGN THIS QUESTION TO THESE VOCABULARY STANDARDS:\n${vocabStandards.join('; ')}\n\nEnsure the question aligns to these standards.`;
          }
          
          const questionFullPrompt = buildFullPrompt(questionAIConfig);
          console.log(`📝 Question ${i + 1} prompt built`);
          
          // Generate the question
          const result = await callAIWithFunction(questionFullPrompt, selectedModel, functionSchema);
          console.log(`✅ Question ${i + 1} generated:`, result);
          
          if (!result || !result.questions || !result.questions[0]) {
            throw new Error(`AI returned invalid response for question ${i + 1}`);
          }
          
          const q = result.questions[0];
          
          // Validate question has required content
          if (!q.question_text || !q.choices || !q.choices.A || !q.choices.B || !q.choices.C || !q.choices.D) {
            console.error(`❌ Invalid MCQ response for question ${i + 1}:`, q);
            throw new Error(`AI generated incomplete question ${i + 1} - missing question text or choices.`);
          }
          
          // Map standards
          let standardsText = q.standards.join('; ');
          let candidateStandards = [];
          
          if (q.standards && q.standards.length > 0) {
            const firstStandard = q.standards[0];
            const mappingResult = await getMappedStandardsWithSource(firstStandard, gradeLevels);
            standardsText = mappingResult.mappedStandards || standardsText;
            sourceStandards[i] = mappingResult.sourceStandard;
            
            candidateStandards = standardsText
              .split(';')
              .map(s => s.trim())
              .filter(s => s && s !== mappingResult.sourceStandard?.code);
          }
          
          // Filter aligned standards using AI if we have context and candidates
          let filteredOutForQuestion = [];
          if (contextText && candidateStandards.length > 0) {
            console.log(`🔍 Filtering ${candidateStandards.length} aligned standards for question ${i + 1}...`);
            const questionText = `${q.question_text}\nA. ${q.choices.A}\nB. ${q.choices.B}\nC. ${q.choices.C}\nD. ${q.choices.D}`;
            const filteredStandards = await filterAlignedStandardsWithAI(
              questionText,
              contextText,
              candidateStandards,
              callAI,
              selectedModel
            );
            console.log(`✅ Filtered to ${filteredStandards.length} standards for question ${i + 1}`);
            
            filteredOutForQuestion = candidateStandards.filter(s => !filteredStandards.includes(s));
            standardsText = filteredStandards.join('; ');
          }
          
          // Insert source standard in proper position
          if (sourceStandards[i] && sourceStandards[i].code) {
            standardsText = insertStandardInOrder(standardsText, sourceStandards[i].code);
          }
          
          // Format question as HTML
          const formattedMCQ = `<p>${i + 1}. ${q.question_text}<br>A. ${q.choices.A}<br>B. ${q.choices.B}<br>C. ${q.choices.C}<br>D. ${q.choices.D}<br>[${standardsText}]<br>KEY: ${q.correct_answer}</p>`;
          formattedQuestions.push(formattedMCQ);
          
          if (filteredOutForQuestion.length > 0) {
            filteredOutStandards[i] = filteredOutForQuestion;
          }
        }
        
        generatedContent = { questions: formattedQuestions, sourceStandards, filteredOutStandards };
      } else {
        // Regular text generation for other field types
        generatedContent = await callAI(prompt, selectedModel, 4096);
      }
      
      console.log('=== AI RESPONSE ===');
      console.log(generatedContent);
      console.log('===================');

      // Update the field value
      setFieldValues(prev => ({ ...prev, [field.id]: generatedContent }));
      setHasGeneratedMap(prev => ({ ...prev, [field.id]: true }));
      
      // Return the generated content so continueGeneration can track it
      return generatedContent;
    } catch (error) {
      console.error('Error generating AI content:', error);
      toast.error(`Failed to generate content: ${error.message}`);
      throw error; // Re-throw so continueGeneration can catch it
    } finally {
      setGeneratingFieldId(null);
    }
  };

  // Load existing lesson template if ID is provided
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    }
  }, [templateId]);

  // Sync fieldValues to localStorage whenever they change
  useEffect(() => {
    const currentFieldValues = JSON.stringify(fieldValues);
    localStorage.setItem('fieldValues', currentFieldValues);
    
    // Skip if empty fieldValues (initial mount)
    if (Object.keys(fieldValues).length === 0) {
      return;
    }
    
    // First time we have data - initialize tracking
    if (previousFieldValuesRef.current === null) {
      previousFieldValuesRef.current = currentFieldValues;
      hasInitializedRef.current = true;
      return; // Don't mark as unsaved on first load
    }
    
    // Only mark as unsaved if fieldValues actually changed
    if (previousFieldValuesRef.current !== currentFieldValues) {
      setHasUnsavedChanges(true);
      previousFieldValuesRef.current = currentFieldValues;
      
      // Auto-save the lesson after a short delay
      if (lessonId && templateData?.id) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
          autoSaveLesson();
        }, 1000); // Auto-save after 1 second of inactivity
      }
    }
  }, [fieldValues]);

  // Prevent accidental page refresh/close when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Click Save before refreshing to avoid losing your work.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const loadTemplate = async (id) => {
    try {
      setLoading(true);
      
      // Fetch lesson template
      const { data: templateData, error: templateError } = await supabase
        .from('lesson_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (templateError) throw templateError;
      
      setTemplateData(templateData);
      
      // Fetch fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('lesson_template_fields')
        .select('*')
        .eq('lesson_template_id', id)
        .order('field_order', { ascending: true });
      
      if (fieldsError) throw fieldsError;
      
      // Map database fields to component format
      const mappedFields = fieldsData.map(field => {
        const mappedField = {
          id: field.id,
          type: field.field_type,
          name: field.name,
          placeholder: field.placeholder_text,
          helperText: field.helper_text,
          required: field.required,
          aiEnabled: field.ai_enabled,
          requiredForGeneration: field.required_for_generation,
          fieldFor: field.field_for || 'designer',
          ai_prompt: field.ai_prompt,
          ai_question_prompts: field.ai_question_prompts,
          ai_context_field_ids: field.ai_context_field_ids,
          ai_system_instructions: field.ai_system_instructions,
          ai_context_instructions: field.ai_context_instructions,
          ai_format_requirements: field.ai_format_requirements
        };
        
        // Add options based on field type
        if (field.field_type === 'grade_band_selector') {
          mappedField.options = gradeRangeConfig.gradeRanges;
        } else if (field.field_type === 'theme_selector') {
          mappedField.options = themeSelectorConfig.themes;
        } else if (field.field_config) {
          // Load field-specific config from field_config JSONB column
          if (field.field_config.options) mappedField.options = field.field_config.options;
          if (field.field_config.min_selections !== undefined) mappedField.min_selections = field.field_config.min_selections;
          if (field.field_config.max_selections !== undefined) mappedField.max_selections = field.field_config.max_selections;
          if (field.field_config.framework) mappedField.framework = field.field_config.framework;
        }
        
        return mappedField;
      });
      
      console.log('🔍 Loaded fields:', mappedFields);
      console.log('🔍 Designer fields with required_for_generation:', 
        mappedFields.filter(f => f.fieldFor === 'designer' && f.requiredForGeneration === true)
      );
      
      setFields(mappedFields);
      
      // ⭐ REQUIRED FOR GENERATION ⭐
      const requiredForGen = mappedFields.filter(f => f.requiredForGeneration === true);
      if (requiredForGen.length > 0) {
        console.log('\n%c🎯 FIELDS REQUIRED FOR GENERATION 🎯', 'background: #ff0; color: #000; font-size: 16px; font-weight: bold; padding: 8px;');
        requiredForGen.forEach(field => {
          console.log(`%c  • ${field.name} (${field.fieldFor})`, 'color: #0080ff; font-weight: bold; font-size: 14px;');
        });
        console.log('\n');
      }
      
      // ⚠️ NON-AI-ENABLED FIELDS ⚠️
      const nonAIFields = mappedFields.filter(f => !f.aiEnabled);
      if (nonAIFields.length > 0) {
        console.log('%c⚠️ FIELDS NOT AI-ENABLED ⚠️', 'background: #f80; color: #fff; font-size: 16px; font-weight: bold; padding: 8px;');
        nonAIFields.forEach(field => {
          console.log(`%c  • ${field.name} (${field.fieldFor})`, 'color: #f80; font-weight: bold; font-size: 14px;');
        });
        console.log('\n');
      }
      
      // Show pre-form modal if there are required non-AI fields
      // Show all fields that are EITHER required for generation OR not AI-enabled (union of both lists)
      const preFormFields = mappedFields.filter(f => f.requiredForGeneration || !f.aiEnabled);
      console.log('🔍 Pre-form fields check:', {
        preFormFieldsCount: preFormFields.length,
        preFormFields: preFormFields.map(f => f.name),
        lessonId,
        preFormCompleted
      });
      
      if (!lessonId && preFormFields.length > 0 && !preFormCompleted) {
        console.log('✅ Showing pre-form modal!');
        setShowPreFormModal(true);
      } else {
        console.log('❌ Not showing pre-form modal because:', {
          hasLessonId: !!lessonId,
          hasPreFormFields: preFormFields.length > 0,
          alreadyCompleted: preFormCompleted
        });
      }
      
      // Load existing lesson if lessonId is provided
      if (lessonId) {
        // Try to acquire lock first
        const lockResult = await acquireLessonLock(lessonId);
        if (!lockResult.success) {
          console.log('🔒 Lesson is locked by:', lockResult.lockedBy);
          // Lesson is locked - will show preview mode after loading data
        }
        
        const { data: lesson, error: lessonError } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single();
        
        if (lessonError) {
          console.error('Error loading lesson:', lessonError);
        } else if (lesson) {
          console.log('📦 Loaded lesson data:', lesson);
          console.log('📦 Designer responses:', lesson.designer_responses);
          console.log('📦 Builder responses:', lesson.builder_responses);
          
          const userAIConfig = lesson.user_ai_config || {};
          const mergedFields = mappedFields.map(field => {
            const override = userAIConfig?.[field.id];
            if (!override) return field;
            return {
              ...field,
              ai_prompt: override.ai_prompt ?? field.ai_prompt,
              ai_question_prompts: override.ai_question_prompts ?? field.ai_question_prompts,
              ai_context_field_ids: override.ai_context_field_ids ?? field.ai_context_field_ids,
              ai_system_instructions: override.ai_system_instructions ?? field.ai_system_instructions,
              ai_context_instructions: override.ai_context_instructions ?? field.ai_context_instructions,
              ai_format_requirements: override.ai_format_requirements ?? field.ai_format_requirements
            };
          });
          setFields(mergedFields);
          
          // Load existing field values from designer_responses and builder_responses
          // Now using field IDs as keys (matching how we save)
          const loadedValues = {};
          mergedFields.forEach(field => {
            if (field.fieldFor === 'designer' && lesson.designer_responses?.[field.id]) {
              loadedValues[field.id] = lesson.designer_responses[field.id];
              console.log(`✅ Loaded designer field: ${field.name} (${field.id})`, lesson.designer_responses[field.id]);
            } else if (field.fieldFor === 'builder' && lesson.builder_responses?.[field.id]) {
              loadedValues[field.id] = lesson.builder_responses[field.id];
              console.log(`✅ Loaded builder field: ${field.name} (${field.id})`, lesson.builder_responses[field.id]);
            }
          });
          console.log('📦 Final loadedValues:', loadedValues);
          setFieldValues(loadedValues);
          
          // If lesson is locked, generate preview markdown for display
          if (!lockResult.success) {
            const templateNameToFunctionMap = {
              'Additional Reading Practice': generateAdditionalReadingPracticeMarkdown,
              'Additional Reading Practice (Florida)': generateAdditionalReadingPracticeFloridaMarkdown
            };
            
            const generateFunction = templateNameToFunctionMap[templateData?.name];
            if (generateFunction) {
              let markdown = generateFunction(templateData, mergedFields, loadedValues);
              
              // Extract image URL from markdown
              let imageUrl = lesson.cover_image_url;
              const photoLinkMatch = markdown.match(/#Photo Link\s*\n\s*([^\s\n]+)/);
              if (photoLinkMatch && photoLinkMatch[1]) {
                imageUrl = photoLinkMatch[1];
                markdown = markdown.replace(/#Photo Link\s*\n\s*[^\n]+\n*/g, '');
              }
              
              // Clean up markdown for preview
              markdown = markdown.replace(/#Additional Notes\s*\n[\s\S]*?(?=\n#|\n*$)/g, '');
              markdown = markdown.replace(/^#([^#\s])/gm, '### $1');
              markdown = markdown.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<span style="font-weight: 600; color: #3b82f6;">$1</span>');
              
              setPreviewMarkdown(markdown);
              setPreviewCoverImage(imageUrl);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading lesson template:', error);
      toast.error('Failed to load lesson template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if a Content ID is already used by another lesson
  const checkDuplicateContentId = async (contentIdValue) => {
    if (!contentIdValue?.trim()) return null;
    try {
      // Find all "Content ID" field IDs across all templates
      const { data: cidFields, error: fieldsError } = await supabase
        .from('lesson_template_fields')
        .select('id')
        .ilike('name', 'Content ID');
      if (fieldsError || !cidFields?.length) return null;

      const trimmed = contentIdValue.trim();
      for (const f of cidFields) {
        const query = supabase
          .from('lessons')
          .select('id, template_name')
          .filter(`designer_responses->>` + f.id, 'eq', trimmed);
        if (lessonId) query.neq('id', lessonId);
        const { data: matches } = await query.limit(1);
        if (matches?.length > 0) return { ...matches[0], contentId: trimmed };
      }
      return null;
    } catch (err) {
      console.warn('Content ID uniqueness check failed:', err);
      return null;
    }
  };

  // Proceed with saving — always checks for duplicate Content IDs
  const executeSave = async () => {
    if (!templateData?.id) {
      toast.warning('No template selected.');
      return;
    }
    
    try {
      // Get current field values from state
      const currentFieldValues = fieldValues;
      
      console.log('💾 === SAVING LESSON ===');
      console.log('💾 Template ID:', templateData.id);
      console.log('💾 Lesson ID:', lessonId || 'NEW');
      console.log('💾 Current field values:', currentFieldValues);
      
      const { designerResponses, builderResponses } = buildFieldResponses(fields, currentFieldValues, { keyBy: 'id' });

      // Check for duplicate Content ID — hard block, no bypass
      const contentIdField = fields.find(f => f.name === 'Content ID' && f.fieldFor === 'designer');
      const contentIdValue = contentIdField ? currentFieldValues[contentIdField.id] : null;
      if (contentIdValue?.trim()) {
        const duplicate = await checkDuplicateContentId(contentIdValue);
        if (duplicate) {
          setDuplicateContentIdWarning(duplicate);
          return; // Block save until Content ID is changed
        }
      }
      
      console.log('💾 Final designer responses:', designerResponses);
      console.log('💾 Final builder responses:', builderResponses);
      
      // Create or update lesson
      if (!lessonId) {
        // CREATE NEW LESSON
        console.log('💾 Creating new lesson...');
        
        const { data: newLesson, error: insertError } = await supabase
          .from('lessons')
          .insert({
            lesson_template_id: templateData.id,
            template_name: templateData.name,
            created_by: session?.user?.id,
            designer_responses: designerResponses,
            builder_responses: builderResponses,
            status: 'draft',
            is_test: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Insert error:', insertError);
          throw insertError;
        }
        
        console.log('✅ NEW LESSON CREATED:', newLesson.id);
        setCurrentLessonId(newLesson.id);
        
        // Update URL with new lesson ID
        const newUrl = `${window.location.pathname}?templateId=${templateData.id}&lessonId=${newLesson.id}`;
        window.history.replaceState({}, '', newUrl);
        
      } else {
        // UPDATE EXISTING LESSON
        console.log('💾 Updating existing lesson:', lessonId);
        
        const { error: updateError } = await supabase
          .from('lessons')
          .update({
            designer_responses: designerResponses,
            builder_responses: builderResponses,
            template_name: templateData.name,
            updated_by: session?.user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', lessonId);
        
        if (updateError) {
          console.error('❌ Update error:', updateError);
          throw updateError;
        }
        
        console.log('✅ LESSON UPDATED:', lessonId);
      }
      
      // Clear unsaved changes flag
      setHasUnsavedChanges(false);
      
      // Show success toast
      setShowSaveToast(true);
      setTimeout(() => {
        setShowSaveToast(false);
      }, 3000);
      
      console.log('💾 === SAVE COMPLETE ===');
      
    } catch (error) {
      console.error('❌ ERROR SAVING LESSON:', error);
      console.error('❌ Error details:', error.message, error.details);
      toast.error(`Failed to save lesson: ${error.message}`);
    }
  };

  const handleSave = () => executeSave();

  if (loading) {
    return (
      <div style={loadingContainer}>
        <p style={loadingText}>
          Loading lesson template...
        </p>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1.05);
              box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
            }
            50% {
              transform: scale(1.08);
              box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
            }
          }
          @keyframes arrowBounce {
            0%, 100% {
              transform: translateX(0) scale(1);
            }
            50% {
              transform: translateX(-8px) scale(1.1);
            }
          }
          @keyframes arrowGlow {
            0%, 100% {
              filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.8));
            }
            50% {
              filter: drop-shadow(0 0 16px rgba(245, 158, 11, 1));
            }
          }
        `}
      </style>
      <div style={pageBackground}>
      {/* Show Preview Mode when lesson is locked */}
      {isLessonLocked ? (
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden'
        }}>
          {/* Locked Header */}
          <div style={{
            backgroundColor: '#fef3c7',
            borderBottom: '2px solid #f59e0b',
            padding: '1rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <span style={{ fontSize: '1.5rem' }}>🔒</span>
              <div>
                <p style={{
                  margin: 0,
                  fontWeight: 700,
                  color: '#92400e',
                  fontSize: '1rem'
                }}>
                  This lesson is currently being edited by {lockOwnerName}
                </p>
                <p style={{
                  margin: '0.25rem 0 0 0',
                  color: '#a16207',
                  fontSize: '0.875rem'
                }}>
                  Showing read-only preview. Check back later to edit.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(-1)}
              style={{
                padding: '0.625rem 1.25rem',
                backgroundColor: '#f59e0b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#d97706';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f59e0b';
              }}
            >
              ← Go Back
            </button>
          </div>
          
          {/* Preview Content */}
          <div style={{ padding: '2rem' }}>
            {/* Cover Image */}
            {previewCoverImage && (
              <div style={coverImageContainer}>
                <img 
                  src={previewCoverImage} 
                  alt="Cover" 
                  style={coverImageFull}
                />
              </div>
            )}
            
            {/* Rendered Markdown */}
            <div 
              className="markdown-preview"
              style={markdownBody}
              dangerouslySetInnerHTML={{
                __html: sanitizeHTML(marked.parse(previewMarkdown || '', {
                  breaks: true,
                  gfm: true
                }))
              }}
            />
            <style>{markdownPreviewCSS}</style>
          </div>
        </div>
      ) : (
      <>
      {!showPreFormModal && (
        <div style={pageMaxWidth}>
        {/* Page Header */}
        <div style={pageHeaderRelative}>
          <button
            onClick={handleBack}
            style={backButton}
            {...backButtonHover}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              marginBottom: '0.75rem'
            }}>
              {templateData?.state && (
                <span style={stateBadge}>
                  {US_STATES.find(s => s.value === templateData.state)?.label || templateData.state}
                </span>
              )}
              <h1 style={pageTitle}>
                {templateData?.name || 'New Lesson'}
              </h1>
            </div>
            <p style={pageSubtitle}>
              Fill in the fields and generate educational content with AI
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div style={toolbarContainer}>
          {/* Row 1: AI Model + Generate */}
          <div style={{ ...toolbarRow, position: 'relative' }}>
            <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />

            <button
              ref={generateButtonRef}
              onClick={() => {
                setPulseGenerateButton(false);
                handleGenerateLesson();
              }}
              disabled={isGeneratingLesson || isLessonLocked}
              title={isLessonLocked ? `Lesson is being edited by ${lockOwnerName}` : ''}
              style={{
                ...gradientButton(
                  (isGeneratingLesson || isLessonLocked) ? '#d1d5db' : '#8b5cf6',
                  (isGeneratingLesson || isLessonLocked) ? '#9ca3af' : '#7c3aed',
                  '139, 92, 246'
                ),
                cursor: (isGeneratingLesson || isLessonLocked) ? 'not-allowed' : 'pointer',
                boxShadow: pulseGenerateButton && !isLessonLocked
                  ? '0 0 0 4px rgba(139, 92, 246, 0.35), 0 0 20px rgba(124, 58, 237, 0.55)' 
                  : '0 2px 4px rgba(139, 92, 246, 0.3)',
                opacity: (isGeneratingLesson || isLessonLocked) ? 0.7 : 1,
                animation: (pulseGenerateButton && !isLessonLocked) ? 'pulse 1s ease-in-out infinite' : 'none',
                transform: (pulseGenerateButton && !isLessonLocked) ? 'scale(1.05)' : 'scale(1)'
              }}
              {...liftOnHover('245, 158, 11', () => isGeneratingLesson || isLessonLocked)}
            >
              <Sparkles size={16} />
              {isGeneratingLesson 
                ? `Generating (${currentGenerationIndex + 1}/${totalGenerationFields})...`
                : generationPaused 
                  ? 'Continue Generating Lesson'
                  : 'Generate Lesson'}
            </button>

            {isGeneratingLesson && (
              <button
                type="button"
                onClick={handleStopGeneration}
                style={gradientButton('#ef4444', '#dc2626', '239, 68, 68')}
                {...liftOnHover('239, 68, 68')}
              >
                Stop Generation
              </button>
            )}

            {/* Animated Arrow Indicator */}
            {pulseGenerateButton && !isGeneratingLesson && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                animation: 'arrowBounce 1s ease-in-out infinite, arrowGlow 1s ease-in-out infinite',
                fontSize: '2.5rem',
                marginLeft: '1rem',
                pointerEvents: 'none'
              }}>
                👈
              </div>
            )}
          </div>

          {/* Row 2: Save, Export, Manage Cover Image */}
          <div style={toolbarRow}>
            <button
              onClick={handleSave}
              disabled={isLessonLocked}
              title={isLessonLocked ? `Lesson is being edited by ${lockOwnerName}` : ''}
              style={{
                ...gradientButton('#22c55e', '#16a34a', '34, 197, 94'),
                ...(isLessonLocked ? { background: '#9ca3af', cursor: 'not-allowed', boxShadow: 'none', opacity: 0.7 } : {}),
              }}
              {...(isLessonLocked ? {} : liftOnHover('34, 197, 94'))}
            >
              <Save size={16} />
              Save Lesson
            </button>

            <button
              onClick={handlePreviewLesson}
              style={gradientButton('#3b82f6', '#2563eb', '59, 130, 246')}
              {...liftOnHover('59, 130, 246')}
            >
              <Eye size={16} />
              Preview Lesson
            </button>

            <button
              onClick={handleExportLesson}
              style={gradientButton('#f97316', '#ea580c', '249, 115, 22')}
              {...liftOnHover('249, 115, 22')}
            >
              <Download size={16} />
              Export Lesson Content
            </button>
            
            <button
              onClick={() => setShowUploadCoverImageModal(true)}
              style={gradientButton('#f59e0b', '#d97706', '217, 119, 6')}
              {...liftOnHover('217, 119, 6')}
            >
              <Upload size={16} />
              Manage Cover Image
            </button>
          </div>
        </div>

        {/* Fields Card */}
        <div style={fieldsCard}>
          
          {/* Required field indicator */}
          {fields.some(f => f.required) && (
            <div style={requiredFieldIndicator}>
              * Required field
            </div>
          )}
          
          {/* Fields List */}
          <div style={fieldsLayout(layoutMode)}>
            {/* Designer Fields Section */}
            <FieldSection
              sectionLabel="Designer"
              fieldType="designer"
              fields={fields}
              fieldValues={fieldValues}
              setFieldValues={setFieldValues}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
              showControls={layoutMode === 'stacked'}
              highlightedMissingFields={highlightedMissingFields}
              generatingFieldId={generatingFieldId}
              hasGeneratedMap={hasGeneratedMap}
              handleGenerateAI={handleGenerateAI}
              handleAIConfig={handleAIConfig}
              handleGenerateIndividualMCQ={handleGenerateIndividualMCQ}
              defaultStandardFramework={templateData?.default_standard_framework || 'CCSS'}
              isFieldUsedAsContext={isFieldUsedAsContext}
            />

              {/* Builder Fields Section */}
            <FieldSection
              sectionLabel="Builder"
              fieldType="builder"
              fields={fields}
              fieldValues={fieldValues}
              setFieldValues={setFieldValues}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
              showControls={layoutMode === 'side-by-side'}
              highlightedMissingFields={highlightedMissingFields}
              generatingFieldId={generatingFieldId}
              hasGeneratedMap={hasGeneratedMap}
              handleGenerateAI={handleGenerateAI}
              handleAIConfig={handleAIConfig}
              handleGenerateIndividualMCQ={handleGenerateIndividualMCQ}
              defaultStandardFramework={templateData?.default_standard_framework || 'CCSS'}
              isFieldUsedAsContext={isFieldUsedAsContext}
            />
            </div>
        </div>
      </div>
      )}

      {/* Save Toast Notification */}
      <SaveToast visible={showSaveToast} message="Lesson saved successfully!" />

      <AddEditFieldModal
        visible={isModalOpen}
        onClose={handleModalClose}
        onFieldAdded={handleFieldAdded}
        field={editingField}
      />

      <ConfigureAIModal
        visible={!!aiConfigField}
        onClose={handleAIConfigClose}
        field={aiConfigField}
        lessonTemplateId={templateData?.id}
        lessonId={lessonId}
        allFields={fields}
        onSave={handleAIConfigSave}
        fieldValues={fieldValues}
        mode="lesson"
        defaultStandardFramework={templateData?.default_standard_framework || 'CCSS'}
      />

      <MissingFieldsModal
        visible={showMissingFieldsModal}
        onClose={() => setShowMissingFieldsModal(false)}
        missingFields={missingFields}
      />

      {showSuccessModal && (
        <SuccessModal
          title="Lesson Generation Complete!"
          message="All AI-enabled fields have been successfully generated."
          onClose={() => setShowSuccessModal(false)}
        />
      )}

      {/* Upload Cover Image Modal */}
      {showUploadCoverImageModal && (
        <UploadCoverImageModal
          contentId={fieldValues[fields.find(f => f.name === 'Content ID')?.id]}
          coverImageUrl={fieldValues[fields.find(f => f.name === 'Thumbnail Image')?.id]?.url}
          onClose={() => setShowUploadCoverImageModal(false)}
        />
      )}

      {/* Unsaved Changes Modal */}
      {showUnsavedChangesModal && (
        <UnsavedChangesModal
          onCancel={handleCancelNavigation}
          onDiscard={handleDiscardChanges}
          onSave={handleSaveAndNavigate}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          markdown={exportMarkdown}
          missingRequiredFields={missingRequiredFields}
          templateName={templateData?.name}
          fields={fields}
          fieldValues={fieldValues}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <PreviewModal
          markdown={previewMarkdown}
          coverImage={previewCoverImage}
          missingRequiredFields={missingRequiredFields}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
      </>
      )}

      {/* Duplicate Content ID — Hard Block */}
      {duplicateContentIdWarning && (
        <ConfirmModal
          title="Duplicate Content ID"
          message={`Content ID "${duplicateContentIdWarning.contentId}" is already used by another lesson ("${duplicateContentIdWarning.template_name || 'Unknown'}"). Every lesson must have a unique Content ID to prevent cover image overwrites and export conflicts. Please change the Content ID and try saving again.`}
          confirmText="OK"
          cancelText={null}
          dangerous
          onConfirm={() => setDuplicateContentIdWarning(null)}
          onCancel={() => setDuplicateContentIdWarning(null)}
        />
      )}

      {/* Pre-Form Modal */}
      <PreFormModal
        visible={showPreFormModal}
        onClose={handlePreFormClose}
        fields={fields}
        fieldValues={fieldValues}
        onFieldChange={(fieldId, value) => {
          setFieldValues(prev => ({ ...prev, [fieldId]: value }));
        }}
      />
    </div>
    </>
  );
}
