import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Save, Beaker, ArrowLeft, Sparkles } from 'lucide-react';
import { useSearchParams, useOutletContext, useNavigate } from 'react-router-dom';
import { handleFieldDragEnd } from '../../lib/dragUtils';
import {
  modalOverlay,
  pageBackground, pageMaxWidth, pageHeaderRelative, backButton, backButtonHover,
  pageTitle, pageSubtitle, stateBadge, toolbarRow,
  fieldsCard, requiredFieldIndicator, fieldsLayout,
  loadingContainer, loadingText,
  gradientButton, liftOnHover,
} from '../../styles/shared';
import AddEditFieldModal from '../modals/AddFieldModal';
import NameLessonTypeModal from '../modals/NameLessonTypeModal';
import ConfigureAIModal from '../modals/ConfigureAIModal';
import MissingFieldsModal from '../modals/MissingFieldsModal';
import SuccessModal from '../modals/SuccessModal';
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
import { isEmptyValue, validateContextFieldsForField } from '../../lib/fieldValueUtils';
import { useToast } from '../../hooks/useToast';
import useFieldCRUD from '../../hooks/useFieldCRUD';
import gradeRangeConfig from '../../config/gradeRangeOptions.json';
import themeSelectorConfig from '../../config/themeSelectorOptions.json';
import aiPromptDefaults from '../../config/aiPromptDefaults.json';

export default function CreateNewLessonType() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, profile } = useOutletContext() || {};
  const navigate = useNavigate();
  const toast = useToast();
  const lessonTypeId = searchParams.get('id');
  const testLessonIdParam = searchParams.get('testLessonId');
  const [lessonTypeData, setLessonTypeData] = useState(null);
  const [showNameModal, setShowNameModal] = useState(!lessonTypeId);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(!!lessonTypeId);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showTestLessonToast, setShowTestLessonToast] = useState(false);
  const [fieldValues, setFieldValues] = useState({});
  const [testLessonId, setTestLessonId] = useState(testLessonIdParam || null);
  const [layoutMode, setLayoutMode] = useState('side-by-side'); // 'stacked' or 'side-by-side'
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');

  // AI state for per-field generation
  const [generatingFieldId, setGeneratingFieldId] = useState(null);
  const [aiConfigField, setAIConfigField] = useState(null);
  const [hasGeneratedMap, setHasGeneratedMap] = useState({});

  // Lesson generation state
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [generationPaused, setGenerationPaused] = useState(false);
  const [currentGenerationIndex, setCurrentGenerationIndex] = useState(0);
  const [totalGenerationFields, setTotalGenerationFields] = useState(0);
  const [missingFields, setMissingFields] = useState([]);
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  const [highlightedMissingFields, setHighlightedMissingFields] = useState(new Set());
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showMarkdownExportModal, setShowMarkdownExportModal] = useState(false);
  const [markdownExportData, setMarkdownExportData] = useState(null);
  const [standardFrameworks, setStandardFrameworks] = useState([]);
  const [defaultStandardFramework, setDefaultStandardFramework] = useState('CCSS');
  const generationCancelledRef = useRef(false);
  const autoSaveTimeoutRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const previousFieldValuesRef = useRef(null);
  const autoCreateTestLessonPromiseRef = useRef(null);
  const userHasInteractedRef = useRef(false);

  // Field CRUD hook (add/edit/delete/drag) — includes field_config for template design
  const {
    isModalOpen,
    editingField,
    sensors,
    handleFieldAdded,
    handleEditField,
    handleDeleteField,
    handleModalClose,
    handleDragEnd,
    openAddFieldModal,
  } = useFieldCRUD({
    templateId: lessonTypeData?.id,
    fields,
    setFields,
    session,
    toast,
    includeFieldConfig: true,
  });

  useEffect(() => {
    if (!showMarkdownExportModal) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [showMarkdownExportModal]);

  // Handler: open AI config modal
  const handleAIConfig = (field) => {
    setAIConfigField(field);
  };

  // Handler: close AI config modal
  const handleAIConfigClose = () => {
    setAIConfigField(null);
  };

  // Handler: save AI config
  const handleAIConfigSave = (config) => {
    console.log('AI config saved for field:', aiConfigField?.name, config);
    // Config is already saved to database by the modal
    setFields(prevFields => prevFields.map(f => {
      if (f.id !== aiConfigField?.id) return f;
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
    setAIConfigField(null);
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
        const generatedValue = await handleGenerateAI(field, fieldValues);
        if (generatedValue?.blocked) {
          setIsGeneratingLesson(false);
          return;
        }
        
        // Auto-save after generation
        await autoSaveLesson();
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

  // Validate all required fields before starting generation
  const validateRequiredFields = () => {
    const missing = [];
    const currentValues = fieldValues || {};

    const requiredFields = fields.filter(f => f.requiredForGeneration);
    for (const reqField of requiredFields) {
      const value = currentValues[reqField.id];
      const isEmpty = isEmptyValue(value);

      if (isEmpty) {
        missing.push({
          id: reqField.id,
          name: reqField.name,
          section: reqField.fieldFor === 'designer' ? 'Designer' : 'Builder'
        });
      }
    }

    return missing;
  };

  // Auto-save test lesson (create on first change, update on subsequent changes)
  const autoSaveLesson = async (updatedFieldValues = null) => {
    if (!lessonTypeData?.id) return;

    const valuesToSave = updatedFieldValues || fieldValues;

    try {
      const { designerResponses, builderResponses } = buildFieldResponses(fields, valuesToSave, { keyBy: 'name' });

      let effectiveTestLessonId = testLessonId;

      if (!effectiveTestLessonId) {
        if (!autoCreateTestLessonPromiseRef.current) {
          console.log('💾 Auto-save: No test lesson ID, creating new test lesson...');
          autoCreateTestLessonPromiseRef.current = (async () => {
            const { data: newLesson, error: insertError } = await supabase
              .from('lessons')
              .insert({
                lesson_template_id: lessonTypeData.id,
                template_name: lessonTypeData.name,
                is_test: true,
                status: 'draft',
                designer_responses: designerResponses,
                builder_responses: builderResponses,
                created_by: session?.user?.id,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            if (insertError) {
              console.error('❌ Auto-save insert error:', insertError);
              throw insertError;
            }

            console.log('✅ Auto-save created new test lesson:', newLesson.id);
            setTestLessonId(newLesson.id);

            // Update URL so refresh reloads this test lesson
            const newUrl = `${window.location.pathname}?id=${lessonTypeData.id}&testLessonId=${newLesson.id}`;
            window.history.replaceState({}, '', newUrl);

            return newLesson.id;
          })();
        }

        try {
          effectiveTestLessonId = await autoCreateTestLessonPromiseRef.current;
        } finally {
          autoCreateTestLessonPromiseRef.current = null;
        }

        if (!effectiveTestLessonId) return;
      }

      const { error } = await supabase
        .from('lessons')
        .update({
          designer_responses: designerResponses,
          builder_responses: builderResponses,
          template_name: lessonTypeData.name
        })
        .eq('id', effectiveTestLessonId);

      if (error) {
        console.error('❌ Auto-save error:', error);
        throw new Error(`Failed to auto-save: ${error.message}`);
      }

      console.log('✅ Test lesson auto-saved successfully');
    } catch (error) {
      console.error('Error auto-saving test lesson:', error);
    }
  };

  // Handler: generate individual MCQ question
  const handleGenerateIndividualMCQ = async (fieldId, questionIndex, selectedStandard) => {
    console.log('🎯 Generating individual MCQ:', { fieldId, questionIndex, selectedStandard });
    
    try {
      const field = fields.find(f => f.id === fieldId);
      if (!field) throw new Error('Field not found');
      
      // Fetch AI config from Supabase
      const { data: fieldData, error } = await supabase
        .from('lesson_template_fields')
        .select('ai_prompt, ai_question_prompts, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
        .eq('id', field.id)
        .single();
      
      if (error) throw new Error('Failed to load AI configuration');
      
      // Get field values from localStorage
      const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
      
      // Get question-specific prompt based on questionIndex (0-4 -> q1-q5)
      const questionKey = `q${questionIndex + 1}`;
      let questionPrompt;
      
      // Get default question prompts from aiPromptDefaults.json
      const defaultQuestionPrompts = aiPromptDefaults.fieldTypePrompts?.mcqs?.questionPrompts || {};
      
      // Check for question-specific prompt in ai_question_prompts, fall back to defaults
      // Handle both old format (string) and new format (object with prompt property)
      if (fieldData.ai_question_prompts && fieldData.ai_question_prompts[questionKey]) {
        const saved = fieldData.ai_question_prompts[questionKey];
        questionPrompt = typeof saved === 'string' ? saved : saved.prompt;
      } else if (defaultQuestionPrompts[questionKey]) {
        // Fall back to default prompt for this specific question
        const defaultQ = defaultQuestionPrompts[questionKey];
        questionPrompt = typeof defaultQ === 'string' ? defaultQ : defaultQ.prompt;
        console.log(`📋 Using default prompt for ${questionKey}`);
      } else {
        // Last resort: modify main prompt for single question
        questionPrompt = fieldData.ai_prompt?.replace(/Generate 5 multiple choice questions/gi, 'Generate 1 multiple choice question') || 'Generate 1 multiple choice question';
      }
      
      // Get MCQ-specific format requirements, falling back to defaults
      const mcqFormatRequirements = fieldData.ai_format_requirements || 
        aiPromptDefaults.formatRequirements?.mcqs || 
        '';
      
      // Log context field configuration for debugging
      console.log('🔧 AI Config context fields:', fieldData.ai_context_field_ids);
      console.log('🔧 Available field values keys:', Object.keys(storedFieldValues));
      
      // Build prompt for single question
      const aiConfig = {
        systemInstructions: fieldData.ai_system_instructions || '',
        prompt: questionPrompt,
        formatRequirements: mcqFormatRequirements,
        contextInstructions: fieldData.ai_context_instructions || '',
        selectedFieldIds: fieldData.ai_context_field_ids || [],
        allFields: fields,
        fieldValues: storedFieldValues
      };
      
      // Warn if no context fields are configured
      if (!fieldData.ai_context_field_ids || fieldData.ai_context_field_ids.length === 0) {
        console.warn('⚠️ No context fields configured for MCQ generation - AI may not have passage content');
      }
      
      // Add selected standard to context if provided
      if (selectedStandard) {
        aiConfig.prompt += `\n\nUSE THIS SPECIFIC STANDARD:\nStandard Code: ${selectedStandard.fullCode}\nStandard Statement: ${selectedStandard.statement}`;
      }

      // Check if this question should include vocab and/or main idea standards
      const questionConfig = fieldData.ai_question_prompts?.[questionKey];
      const includeVocabStandards = questionConfig?.includeVocabStandards || false;
      const includeMainIdeaStandards = questionConfig?.includeMainIdeaStandards || false;

      // Add grade-specific standards context based on checkboxes
      const gradeField = fields.find(f => f.type === 'grade_band_selector');
      const gradeValue = gradeField ? storedFieldValues[gradeField.id] : null;
      const gradeLevels = extractGradesFromBand(gradeValue);
      
      const extraContextBlocks = [];
      
      if (includeVocabStandards) {
        const vocabStandards = defaultStandardFramework === 'CCSS'
          ? await getCcssVocabularyStandardsForGrade(gradeLevels)
          : await getMappedVocabularyStandardsForGrade(gradeLevels, defaultStandardFramework);
        
        if (vocabStandards.length > 0) {
          extraContextBlocks.push({
            title: `Grade-Specific Vocabulary Standards (${defaultStandardFramework})`,
            content: vocabStandards.join('; ')
          });
          console.log('📚 Vocab standards added to MCQ prompt (individual):', vocabStandards);
        }
      }
      
      if (includeMainIdeaStandards) {
        const mainIdeaStandards = defaultStandardFramework === 'CCSS'
          ? await getCcssMainIdeaStandardsForGrade(gradeLevels)
          : await getMappedMainIdeaStandardsForGrade(gradeLevels, defaultStandardFramework);
        
        if (mainIdeaStandards.length > 0) {
          extraContextBlocks.push({
            title: `Grade-Specific Main Idea Standards (${defaultStandardFramework})`,
            content: mainIdeaStandards.join('; ')
          });
          console.log('📚 Main Idea standards added to MCQ prompt (individual):', mainIdeaStandards);
        }
      }
      
      if (extraContextBlocks.length > 0) {
        aiConfig.extraContextBlocks = extraContextBlocks;
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
      
      // Format the structured response as text
      const q = result.questions[0];
      
      // Validate question has required content
      if (!q.question_text || !q.choices || !q.choices.A || !q.choices.B || !q.choices.C || !q.choices.D) {
        console.error('❌ Invalid MCQ response:', q);
        throw new Error('AI generated incomplete question - missing question text or choices. Check that context fields (passage) are configured in AI Config.');
      }
      
      // Build context text from configured context fields (e.g., reading passage)
      let contextText = '';
      if (fieldData.ai_context_field_ids && fieldData.ai_context_field_ids.length > 0) {
        const contextParts = [];
        for (const contextFieldId of fieldData.ai_context_field_ids) {
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
      
      // Map standards (works for any framework) and track source
      let standardsText = q.standards.join('; ');
      let sourceStandardInfo = null;
      let candidateStandards = [];
      
      if (selectedStandard && selectedStandard.fullCode) {
        const mappingResult = await getMappedStandardsWithSource(selectedStandard.fullCode, gradeLevels);
        standardsText = mappingResult.mappedStandards || standardsText;
        sourceStandardInfo = mappingResult.sourceStandard;
        
        // Get candidate standards for filtering (excluding source standard)
        candidateStandards = standardsText
          .split(';')
          .map(s => s.trim())
          .filter(s => s && s !== mappingResult.sourceStandard?.code);
      } else if (q.standards && q.standards.length > 0) {
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
        
        // Track what was filtered out
        filteredOutForQuestion = candidateStandards.filter(s => !filteredStandards.includes(s));
        standardsText = filteredStandards.join('; ');
      }
      
      // Insert source standard in its proper framework position (CCSS; TEKS; BEST; BLOOM; GSE order)
      if (sourceStandardInfo && sourceStandardInfo.code) {
        standardsText = insertStandardInOrder(standardsText, sourceStandardInfo.code);
      }
      
      const questionNumber = questionIndex + 1;
      const formattedMCQ = `<p>${questionNumber}. ${q.question_text}<br>A. ${q.choices.A}<br>B. ${q.choices.B}<br>C. ${q.choices.C}<br>D. ${q.choices.D}<br>[${standardsText}]<br>KEY: ${q.correct_answer}</p>`;
      
      // Update only the specific question in the array with source standard tracking
      setFieldValues(prev => {
        const currentValue = prev[fieldId] || { questions: ['', '', '', '', ''], sourceStandards: {}, filteredOutStandards: {} };
        const updatedQuestions = [...(currentValue.questions || ['', '', '', '', ''])];
        updatedQuestions[questionIndex] = formattedMCQ;
        
        // Track source standard for this question
        const updatedSourceStandards = { ...(currentValue.sourceStandards || {}) };
        if (sourceStandardInfo) {
          updatedSourceStandards[questionIndex] = sourceStandardInfo;
        }
        
        // Track filtered-out standards for this question
        const updatedFilteredOut = { ...(currentValue.filteredOutStandards || {}) };
        updatedFilteredOut[questionIndex] = filteredOutForQuestion;
        
        return {
          ...prev,
          [fieldId]: { 
            questions: updatedQuestions,
            sourceStandards: updatedSourceStandards,
            filteredOutStandards: updatedFilteredOut,
            standards: currentValue.standards || {}
          }
        };
      });
      
      setHasGeneratedMap(prev => ({ ...prev, [fieldId]: true }));
    } catch (error) {
      console.error('Error generating individual MCQ:', error);
      toast.error(`Failed to generate question: ${error.message}`);
    }
  };

  // Handler: upload user-provided image for an image field
  const handleUploadImage = async (field, file, existingUrl) => {
    if (!testLessonId) {
      throw new Error('Test lesson must be saved before uploading an image.');
    }

    const templateFolder = lessonTypeData?.name || 'unknown-template';
    const fileName = `${templateFolder}/${testLessonId}.png`;

    // If there's an existing image in storage, delete it first
    if (existingUrl && existingUrl.includes('lesson-images')) {
      console.log('🗑️ Deleting existing image before upload...');
      await supabase.storage.from('lesson-images').remove([fileName]);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Convert file to base64 data URL for alt text generation
    const fileReader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      fileReader.onload = () => resolve(fileReader.result);
      fileReader.onerror = reject;
      fileReader.readAsDataURL(file);
    });

    // Upload file to Supabase Storage
    console.log('☁️ Uploading user image:', fileName);
    const { error: uploadError } = await supabase.storage
      .from('lesson-images')
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: '0',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('lesson-images')
      .getPublicUrl(fileName);
    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
    console.log('✅ Image uploaded to:', cacheBustedUrl);

    // Generate alt text
    let generatedAltText = '';
    try {
      console.log('📝 Generating alt text for uploaded image...');
      generatedAltText = await generateAltText(dataUrl);
      console.log('✅ Alt text generated:', generatedAltText);
    } catch (err) {
      console.warn('Alt text generation failed, continuing without it:', err);
    }

    // Build updated field value
    const imageFieldValue = {
      url: cacheBustedUrl,
      altText: generatedAltText,
      imageModel: 'user-upload',
      altTextModel: generatedAltText ? 'gpt-4o' : '',
      description: fieldValues[field.id]?.description || ''
    };

    // Update state
    setFieldValues(prev => ({ ...prev, [field.id]: imageFieldValue }));
    setHasGeneratedMap(prev => ({ ...prev, [field.id]: true }));

    // Auto-save
    if (testLessonId) {
      const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
      const updatedFieldValues = { ...storedFieldValues, [field.id]: imageFieldValue };

      const designerFields = fields.filter(f => f.fieldFor === 'designer');
      const builderFields = fields.filter(f => f.fieldFor === 'builder');

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
        .eq('id', testLessonId);

      console.log('✅ Test lesson auto-saved after image upload');
    }
  };

  // Handler: trigger AI generation
  const handleGenerateAI = async (field, valuesOverride = null) => {
    userHasInteractedRef.current = true;
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
      
      // Handle image fields specially
      if (field.type === 'image') {
        console.log('🖼️ Generating image for field:', field.id);
        
        // Fetch AI config from Supabase
        console.log('📥 Fetching AI config from Supabase for image field:', field.id);
        const { data: fieldData, error } = await supabase
          .from('lesson_template_fields')
          .select('ai_prompt, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
          .eq('id', field.id)
          .single();
        
        if (error) {
          console.error('Error fetching AI config:', error);
          throw new Error('Failed to load AI configuration');
        }
        
        console.log('✅ Using AI config for image:', fieldData);
        
        // Read field values from localStorage
        const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
        
        // Build prompt using the AI config
        const aiConfig = {
          systemInstructions: fieldData.ai_system_instructions || '',
          prompt: fieldData.ai_prompt || '',
          formatRequirements: fieldData.ai_format_requirements || '',
          contextInstructions: fieldData.ai_context_instructions || '',
          selectedFieldIds: fieldData.ai_context_field_ids || [],
          allFields: fields,
          fieldValues: storedFieldValues
        };

        // Build the prompt using the shared function
        let imagePrompt = buildFullPrompt(aiConfig);

        // Extract passage (if present in context fields) to summarize for image guidance
        let passageText = '';
        if (fieldData.ai_context_field_ids && fieldData.ai_context_field_ids.length > 0) {
          fieldData.ai_context_field_ids.forEach(id => {
            const contextField = fields.find(f => f.id === id);
            const val = storedFieldValues[id];
            if (contextField && val && !passageText && /passage/i.test(contextField.name)) {
              const displayVal = typeof val === 'string' ? val : (val.text || val.value || JSON.stringify(val));
              passageText = displayVal.replace(/<[^>]*>/g, '').trim();
            }
          });
        }
        
        // Add the optional user-provided image description if it exists
        const currentFieldValue = storedFieldValues[field.id];
        if (currentFieldValue && currentFieldValue.description && currentFieldValue.description.trim()) {
          imagePrompt = `${currentFieldValue.description}\n\n${imagePrompt}`;
          console.log('✏️ Added user-provided image description to prompt');
        }
        
        if (passageText) {
          console.log('📝 Summarizing passage for image guidance...');
          const passageSummary = await summarizePassageForImage(passageText, 700);
          if (passageSummary) {
            imagePrompt = `Passage summary for cover image (<=700 chars):\n${passageSummary}\n\n${imagePrompt}`;
          }
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
        
        if (!testLessonId) {
          throw new Error('Test lesson must be saved before generating an image. Please save first.');
        }
        
        const templateFolder = lessonTypeData?.name || 'unknown-template';
        const fileName = `${templateFolder}/${testLessonId}.png`;
        
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
        
        // Store the public URL
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
        console.log('💾 Auto-saving test lesson after image generation...');
        if (testLessonId) {
          const updatedFieldValues = { ...storedFieldValues, [field.id]: imageFieldValue };
          const { designerResponses, builderResponses } = buildFieldResponses(fields, updatedFieldValues, { keyBy: 'name' });
          
          await supabase
            .from('lessons')
            .update({
              designer_responses: designerResponses,
              builder_responses: builderResponses
            })
            .eq('id', testLessonId);
          
          console.log('✅ Test lesson auto-saved');
        }
        
        console.log('✅ Image generation complete');
        setGeneratingFieldId(null);
        return;
      }
      
      // Fetch fresh AI config from Supabase
      console.log('📥 Fetching AI config from Supabase for field:', field.id);
      const { data: fieldData, error } = await supabase
        .from('lesson_template_fields')
        .select('ai_prompt, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
        .eq('id', field.id)
        .single();
      
      if (error) {
        console.error('Error fetching AI config:', error);
        throw new Error('Failed to load AI configuration');
      }
      
      console.log('✅ Fetched AI config from Supabase:', fieldData);
      
      // Read field values from localStorage (same as ConfigureAIModal preview)
      const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
      
      // Build prompt using fresh data from Supabase
      const aiConfig = {
        systemInstructions: fieldData.ai_system_instructions || '',
        prompt: fieldData.ai_prompt || '',
        formatRequirements: fieldData.ai_format_requirements || '',
        contextInstructions: fieldData.ai_context_instructions || '',
        selectedFieldIds: fieldData.ai_context_field_ids || [],
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
        
        // Fetch ai_question_prompts from database
        const { data: questionPromptsData } = await supabase
          .from('lesson_template_fields')
          .select('ai_question_prompts')
          .eq('id', field.id)
          .single();
        const questionPromptsConfig = questionPromptsData?.ai_question_prompts;
        
        // Extract grade level from fieldValues
        const gradeField = fields.find(f => f.type === 'grade_band_selector');
        const gradeValue = gradeField ? fieldValues[gradeField.id] : null;
        const gradeLevels = extractGradesFromBand(gradeValue);

        // Resolve default vocab standards when using CCSS
        const vocabStandards = defaultStandardFramework === 'CCSS'
          ? await getCcssVocabularyStandardsForGrade(gradeLevels)
          : await getMappedVocabularyStandardsForGrade(gradeLevels, defaultStandardFramework);
        if (vocabStandards.length > 0) {
          console.log('📚 Vocab standards added to MCQ prompts (sequential):', vocabStandards);
        }
        
        // Build context text from configured context fields (e.g., reading passage)
        let contextText = '';
        if (fieldData.ai_context_field_ids && fieldData.ai_context_field_ids.length > 0) {
          const contextParts = [];
          for (const contextFieldId of fieldData.ai_context_field_ids) {
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
            systemInstructions: fieldData.ai_system_instructions || '',
            prompt: questionPrompt,
            formatRequirements: fieldData.ai_format_requirements || aiPromptDefaults.formatRequirements?.mcqs || '',
            contextInstructions: fieldData.ai_context_instructions || '',
            selectedFieldIds: fieldData.ai_context_field_ids || [],
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
          
          // Format question as plain text (not HTML for template mode)
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
      
      console.log('Generated content:', generatedContent);

      // Update the field value
      setFieldValues(prev => ({ ...prev, [field.id]: generatedContent }));
      setHasGeneratedMap(prev => ({ ...prev, [field.id]: true }));
      
    } catch (error) {
      console.error('Error generating AI content:', error);
      toast.error(`Failed to generate content: ${error.message}`);
    } finally {
      setGeneratingFieldId(null);
    }
  };

  // Load existing lesson template if ID is provided
  useEffect(() => {
    if (lessonTypeId) {
      loadLessonType(lessonTypeId);
    }
  }, [lessonTypeId]);

  // Sync fieldValues to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('fieldValues', JSON.stringify(fieldValues));
  }, [fieldValues]);

  // Auto-save test lesson when field values change (1-second debounce)
  // Only triggers after the user has actually interacted with a field.
  useEffect(() => {
    const currentFieldValues = fieldValues;

    // First time we have data - initialize tracking
    if (previousFieldValuesRef.current === null) {
      previousFieldValuesRef.current = currentFieldValues;
      hasInitializedRef.current = true;
      return; // Don't auto-save on first load
    }

    // Only auto-save if fieldValues actually changed AND user has interacted
    if (previousFieldValuesRef.current !== currentFieldValues) {
      previousFieldValuesRef.current = currentFieldValues;

      if (lessonTypeData?.id && userHasInteractedRef.current) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
          autoSaveLesson();
        }, 1000);
      }
    }
  }, [fieldValues]);

  const loadLessonType = async (id) => {
    try {
      setLoading(true);
      
      // Fetch lesson template
      const { data: lessonTypeData, error: lessonTypeError } = await supabase
        .from('lesson_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (lessonTypeError) throw lessonTypeError;
      
      setLessonTypeData(lessonTypeData);
      const templateDefaultFramework = lessonTypeData.default_standard_framework || 'CCSS';
      setDefaultStandardFramework(templateDefaultFramework);
      
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
          ai_context_field_ids: field.ai_context_field_ids
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
          if (field.field_config.framework) {
            mappedField.framework = field.field_config.framework;
          } else if (mappedField.type === 'assign_standards' && templateDefaultFramework) {
            mappedField.framework = templateDefaultFramework;
          }
        }
        
        return mappedField;
      });
      
      setFields(mappedFields);
      
      // Only auto-load test lesson if testLessonIdParam is explicitly provided
      // This ensures fresh start when creating new templates or opening templates without test lessons
      let existingLesson = null;
      
      if (testLessonIdParam) {
        // Load specific test lesson by ID (coming from Browse Lessons)
        const { data } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', testLessonIdParam)
          .single();
        existingLesson = data;
      }
      
      if (existingLesson) {
        setTestLessonId(existingLesson.id);
        // Load existing field values from designer_responses and builder_responses
        const loadedValues = {};
        mappedFields.forEach(field => {
          if (field.fieldFor === 'designer' && existingLesson.designer_responses?.[field.name]) {
            loadedValues[field.id] = existingLesson.designer_responses[field.name];
          } else if (field.fieldFor === 'builder' && existingLesson.builder_responses?.[field.name]) {
            loadedValues[field.id] = existingLesson.builder_responses[field.name];
          }
        });
        setFieldValues(loadedValues);
      }
    } catch (error) {
      console.error('Error loading lesson template:', error);
      toast.error('Failed to load lesson template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyDefaultStandardFramework = async (framework) => {
    if (!lessonTypeData?.id) {
      toast.warning('Please save the lesson template first.');
      return;
    }

    const previousFramework = defaultStandardFramework;
    setDefaultStandardFramework(framework);

    try {
      const { error: templateError } = await supabase
        .from('lesson_templates')
        .update({
          default_standard_framework: framework,
          updated_at: new Date().toISOString()
        })
        .eq('id', lessonTypeData.id);

      if (templateError) throw templateError;

      const assignStandardsFields = fields.filter(f => f.type === 'assign_standards');
      const mcqFieldsToUpdate = fields.filter(
        f => f.type === 'mcqs' && (!f.framework || f.framework === previousFramework)
      );
      const frameworkFields = [...assignStandardsFields, ...mcqFieldsToUpdate];

      if (frameworkFields.length > 0) {
        const updates = frameworkFields.map(field => {
          const updatedFieldConfig = {
            options: field.options,
            min_selections: field.min_selections,
            max_selections: field.max_selections,
            framework
          };

          return supabase
            .from('lesson_template_fields')
            .update({ field_config: updatedFieldConfig })
            .eq('id', field.id);
        });

        const results = await Promise.all(updates);
        const updateErrors = results.find(r => r.error);
        if (updateErrors?.error) throw updateErrors.error;
      }

      setFields(prev => prev.map(field => {
        if (field.type === 'assign_standards') {
          return { ...field, framework };
        }
        if (field.type === 'mcqs' && (!field.framework || field.framework === previousFramework)) {
          return { ...field, framework };
        }
        return field;
      }));

      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (error) {
      console.error('Error updating default standard framework:', error);
      toast.error('Failed to update default standard framework. Please try again.');
    }
  };

  useEffect(() => {
    const loadFrameworksFromCsv = async () => {
      try {
        const response = await fetch(new URL('../../assets/MOAC SLB – No Letter CCSS.csv', import.meta.url).href);
        const text = await response.text();
        const lines = text.split('\n');
        const frameworksOrder = ['CCSS', 'BEST', 'BLOOM', 'TEKS', 'GSE'];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          const values = [];
          let current = '';
          let inQuotes = false;
          for (let char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());

          const mappedFramework = values[2];
          if (frameworksOrder.includes(mappedFramework)) {
            // Just confirm framework presence
          }
        }
        setStandardFrameworks(frameworksOrder);
      } catch (error) {
        console.error('Error loading standards frameworks:', error);
      }
    };

    loadFrameworksFromCsv();
  }, []);



  const handleNameSave = async (data) => {
    setLessonTypeData(data);
    setShowNameModal(false);
    
    // Create initial lesson template in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: lessonType, error } = await supabase
        .from('lesson_templates')
        .insert({
          name: data.name,
          category: data.category,
          state: data.state,
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setLessonTypeData({ ...data, id: lessonType.id });

      // Update the URL so a refresh reloads this template
      setSearchParams({ id: lessonType.id }, { replace: true });
      
      // Generate markdown export file for the new template
      try {
        // Import the utility functions dynamically
        const { 
          templateNameToCamelCase, 
          generateMarkdownExportFileContent,
          generateImportStatement,
          generateMapEntry
        } = await import('../../export/generateMarkdownExportFile.js');
        
        const camelCaseName = templateNameToCamelCase(data.name);
        const fileName = `${camelCaseName}MarkdownExport.js`;
        const fileContent = generateMarkdownExportFileContent(data.name);
        const importStatement = generateImportStatement(data.name);
        const mapEntry = generateMapEntry(data.name);
        
        // Show modal with instructions
        setMarkdownExportData({
          fileName,
          filePath: `src/export/templates/${fileName}`,
          fileContent,
          importStatement,
          mapEntry,
          templateName: data.name
        });
        setShowMarkdownExportModal(true);
      } catch (exportError) {
        console.error('Error generating markdown export file instructions:', exportError);
      }
      
      // Load existing fields if any
      const { data: existingFields } = await supabase
        .from('lesson_template_fields')
        .select('*')
        .eq('lesson_template_id', lessonType.id)
        .order('field_order');
      
      if (existingFields) {
        setFields(existingFields.map(f => ({
          id: f.id,
          type: f.field_type,
          name: f.name,
          placeholder: f.placeholder_text,
          helperText: f.helper_text,
          required: f.required,
          aiEnabled: f.ai_enabled
        })));
      }
    } catch (error) {
      console.error('Error creating lesson template:', error);
      toast.error('Failed to create lesson template. Please try again.');
    }
  };

  const handleSave = () => {
    // Show toast notification
    setShowSaveToast(true);
    
    // Hide toast after delay
    setTimeout(() => {
      setShowSaveToast(false);
    }, 3000);
  };

  const handleSaveTestLesson = async () => {
    if (!lessonTypeData?.id) {
      toast.warning('Please save the lesson template first.');
      return;
    }

    const { designerResponses, builderResponses } = buildFieldResponses(fields, fieldValues, { keyBy: 'name' });

    try {
      let data, error;
      
      if (testLessonId) {
        // Try to update existing test lesson
        const result = await supabase
          .from('lessons')
          .update({
            designer_responses: designerResponses,
            builder_responses: builderResponses,
            template_name: lessonTypeData.name
          })
          .eq('id', testLessonId)
          .select();
        
        // If update returns no rows, the lesson doesn't exist - create it instead
        if (result.data && result.data.length === 0) {
          const insertResult = await supabase
            .from('lessons')
            .insert({
              lesson_template_id: lessonTypeData.id,
              template_name: lessonTypeData.name,
              is_test: true,
              status: 'draft',
              designer_responses: designerResponses,
              builder_responses: builderResponses,
              created_by: session?.user?.id
            })
            .select()
            .single();
          data = insertResult.data;
          error = insertResult.error;
          if (data) {
            setTestLessonId(data.id);
          }
        } else {
          data = result.data?.[0];
          error = result.error;
        }
      } else {
        // Create new test lesson
        const result = await supabase
          .from('lessons')
          .insert({
            lesson_template_id: lessonTypeData.id,
            template_name: lessonTypeData.name,
            is_test: true,
            status: 'draft',
            designer_responses: designerResponses,
            builder_responses: builderResponses,
            created_by: session?.user?.id
          })
          .select()
          .single();
        data = result.data;
        error = result.error;
        
        if (data) {
          setTestLessonId(data.id);
        }
      }

      if (error) throw error;

      console.log('Test lesson saved:', data);
      
      // Show success toast
      setShowTestLessonToast(true);
      setTimeout(() => {
        setShowTestLessonToast(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving test lesson:', error);
      toast.error('Failed to save test lesson. Please try again.');
    }
  };

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
    <div style={pageBackground}>
      <div style={pageMaxWidth}>
        {/* Page Header */}
        <div style={pageHeaderRelative}>
          <button
            onClick={() => navigate('/browse-lesson-templates?mode=edit')}
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
              {lessonTypeData?.state && (
                <span style={stateBadge}>
                  {US_STATES.find(s => s.value === lessonTypeData.state)?.label || lessonTypeData.state}
                </span>
              )}
              <h1 style={pageTitle}>
                {lessonTypeData?.name || 'Create New Lesson Template'}
              </h1>
            </div>
            <p style={pageSubtitle}>
              {APP_CONFIG.pages.createNewLessonType.subtitle}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          {/* Toolbar Content - AI Model, Generate, Save Actions */}
          <div style={{ ...toolbarRow, flexWrap: 'wrap' }}>
            <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              background: '#fff',
              border: '1px solid var(--gray-200)',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-600)' }}>📚 Default Standard Framework</span>
              <select
                value={defaultStandardFramework}
                onChange={(e) => applyDefaultStandardFramework(e.target.value)}
                style={{
                  padding: '0.35rem 0.5rem',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  backgroundColor: '#fff'
                }}
              >
                {standardFrameworks.map(fw => (
                  <option key={fw} value={fw}>{fw}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateLesson}
              disabled={isGeneratingLesson}
              style={{
                ...gradientButton(
                  isGeneratingLesson ? '#d1d5db' : '#8b5cf6',
                  isGeneratingLesson ? '#9ca3af' : '#7c3aed',
                  '139, 92, 246'
                ),
                cursor: isGeneratingLesson ? 'not-allowed' : 'pointer',
                opacity: isGeneratingLesson ? 0.7 : 1
              }}
              {...(isGeneratingLesson ? {} : liftOnHover('139, 92, 246'))}
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

            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--gray-300)' }} />

            <button
              onClick={handleSaveTestLesson}
              style={gradientButton('#3b82f6', '#2563eb', '59, 130, 246')}
              {...liftOnHover('59, 130, 246')}
            >
              <Beaker size={16} />
              Save Test Lesson
            </button>
            
            <button
              onClick={handleSave}
              style={gradientButton('#22c55e', '#16a34a', '34, 197, 94')}
              {...liftOnHover('34, 197, 94')}
            >
              <Save size={16} />
              Save Template
            </button>
          </div>


        </div>

        {/* Fields Card */}
        <div style={fieldsCard} onPointerDown={() => { userHasInteractedRef.current = true; }}>
          
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
              sensors={sensors}
              handleDragEnd={handleDragEnd}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
              showControls={layoutMode === 'stacked'}
              highlightedMissingFields={highlightedMissingFields}
              generatingFieldId={generatingFieldId}
              hasGeneratedMap={hasGeneratedMap}
              handleGenerateAI={handleGenerateAI}
              handleAIConfig={handleAIConfig}
              handleGenerateIndividualMCQ={handleGenerateIndividualMCQ}
              defaultStandardFramework={defaultStandardFramework}
              onEditField={handleEditField}
              onDeleteField={handleDeleteField}
              onAddField={openAddFieldModal}
              onUploadImage={handleUploadImage}
            />

            {/* Builder Fields Section */}
            <FieldSection
              sectionLabel="Builder"
              fieldType="builder"
              fields={fields}
              fieldValues={fieldValues}
              setFieldValues={setFieldValues}
              sensors={sensors}
              handleDragEnd={handleDragEnd}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
              showControls={layoutMode === 'side-by-side'}
              highlightedMissingFields={highlightedMissingFields}
              generatingFieldId={generatingFieldId}
              hasGeneratedMap={hasGeneratedMap}
              handleGenerateAI={handleGenerateAI}
              handleAIConfig={handleAIConfig}
              handleGenerateIndividualMCQ={handleGenerateIndividualMCQ}
              defaultStandardFramework={defaultStandardFramework}
              onEditField={handleEditField}
              onDeleteField={handleDeleteField}
              onAddField={openAddFieldModal}
              onUploadImage={handleUploadImage}
            />
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <SaveToast visible={showSaveToast} message="Lesson template saved successfully!" />
      <SaveToast visible={showTestLessonToast} message="Test lesson saved successfully!" />

      <NameLessonTypeModal
        visible={showNameModal}
        onClose={() => setShowNameModal(false)}
        onSave={handleNameSave}
        initialName={lessonTypeData?.name || ''}
        initialCategory={lessonTypeData?.category || 'Core ELA'}
        initialState={lessonTypeData?.state || ''}
      />

      <AddEditFieldModal
        visible={isModalOpen}
        onClose={handleModalClose}
        onFieldAdded={handleFieldAdded}
        field={editingField}
        defaultFramework={defaultStandardFramework}
      />

      <ConfigureAIModal
        visible={!!aiConfigField}
        onClose={handleAIConfigClose}
        field={aiConfigField}
        lessonTemplateId={lessonTypeData?.id}
        allFields={fields}
        onSave={handleAIConfigSave}
        fieldValues={fieldValues}
        defaultStandardFramework={defaultStandardFramework}
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

      {/* Markdown Export Instructions Modal */}
      {showMarkdownExportModal && markdownExportData && createPortal(
        <div
          style={{
            ...modalOverlay,
            zIndex: 9999,
            padding: '2rem'
          }}
          onClick={() => setShowMarkdownExportModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid #e5e7eb',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
                📝 Markdown Export File Setup
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.875rem' }}>
                Template: {markdownExportData.templateName}
              </p>
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '2rem'
            }}>
              {/* Step 1 */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', color: '#1f2937', fontSize: '1.125rem', fontWeight: 600 }}>
                  Step 1: Create the markdown export file
                </h3>
                <div style={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  color: '#374151',
                  position: 'relative'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>File path:</strong> {markdownExportData.filePath}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(markdownExportData.fileContent);
                      toast.success('File content copied to clipboard!');
                    }}
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Copy Content
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', color: '#1f2937', fontSize: '1.125rem', fontWeight: 600 }}>
                  Step 2: Add import to CreateNewLesson.jsx
                </h3>
                <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  Add this after the other markdown export imports:
                </p>
                <div style={{
                  backgroundColor: '#1f2937',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  color: '#10b981',
                  position: 'relative'
                }}>
                  <code>{markdownExportData.importStatement}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(markdownExportData.importStatement);
                      toast.success('Import statement copied!');
                    }}
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#374151',
                      color: '#fff',
                      border: '1px solid #4b5563',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', color: '#1f2937', fontSize: '1.125rem', fontWeight: 600 }}>
                  Step 3: Add entry to templateNameToFunctionMap
                </h3>
                <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  Add this inside the templateNameToFunctionMap object:
                </p>
                <div style={{
                  backgroundColor: '#1f2937',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  color: '#10b981',
                  position: 'relative'
                }}>
                  <code>{markdownExportData.mapEntry}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(markdownExportData.mapEntry);
                      toast.success('Map entry copied!');
                    }}
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#374151',
                      color: '#fff',
                      border: '1px solid #4b5563',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* File Content Preview */}
              <div>
                <h3 style={{ margin: '0 0 0.75rem 0', color: '#1f2937', fontSize: '1.125rem', fontWeight: 600 }}>
                  File Content Preview
                </h3>
                <div style={{
                  backgroundColor: '#1f2937',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#d1d5db',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.5'
                }}>
                  {markdownExportData.fileContent}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '1.5rem 2rem',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowMarkdownExportModal(false)}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
