import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Save, Check, Beaker, ArrowLeft, Sparkles, Columns2, Rows3, ChevronDown, GripVertical } from 'lucide-react';
import { useSearchParams, useOutletContext, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddEditFieldModal from '../modals/AddFieldModal';
import NameLessonTypeModal from '../modals/NameLessonTypeModal';
import ConfigureAIModal from '../modals/ConfigureAIModal';
import MissingFieldsModal from '../modals/MissingFieldsModal';
import SuccessModal from '../modals/SuccessModal';
import BaseField from '../fields/BaseField';
import TextField from '../fields/TextField';
import RichTextField from '../fields/RichTextField';
import { buildFullPrompt } from '../../lib/promptBuilder';
import DropdownField from '../fields/DropdownField';
import ChecklistField from '../fields/ChecklistField';
import ImageField from '../fields/ImageField';
import AssignStandardsField from '../fields/AssignStandardsField';
import MCQsField from '../fields/MCQsField';
import { APP_CONFIG } from '../../config';
import { supabase } from '../../lib/supabaseClient';
import { US_STATES } from '../../config/usStates';
import { callAI, callAIWithFunction, callAIWithBatchedContext, generateImage, generateAltText, summarizePassageForImage } from '../../lib/aiClient';
import { getFormattedMappedStandardsFromAny, getMappedStandardsWithSource, extractGradeFromBand, filterAlignedStandardsWithAI, insertStandardInOrder, getCcssVocabularyStandardsForGrade, getMappedVocabularyStandardsForGrade } from '../../lib/standardsMapper';
import gradeRangeConfig from '../../config/gradeRangeOptions.json';
import themeSelectorConfig from '../../config/themeSelectorOptions.json';
import aiPromptDefaults from '../../config/aiPromptDefaults.json';

// Sortable Field Wrapper Component
function SortableField({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ position: 'relative' }}>
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            left: '-2rem',
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'grab',
            color: '#8b5cf6',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#6d28d9'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8b5cf6'}
          title="Drag to reorder"
        >
          <GripVertical size={20} />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CreateNewLessonType() {
  const [searchParams] = useSearchParams();
  const { session, profile } = useOutletContext() || {};
  const navigate = useNavigate();
  const lessonTypeId = searchParams.get('id');
  const testLessonIdParam = searchParams.get('testLessonId');
  const [lessonTypeData, setLessonTypeData] = useState(null);
  const [showNameModal, setShowNameModal] = useState(!lessonTypeId);
  const [fields, setFields] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [loading, setLoading] = useState(!!lessonTypeId);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showTestLessonToast, setShowTestLessonToast] = useState(false);
  const [fieldValues, setFieldValues] = useState({});
  const [testLessonId, setTestLessonId] = useState(testLessonIdParam || null);
  const [layoutMode, setLayoutMode] = useState('side-by-side'); // 'stacked' or 'side-by-side'
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelButtonRef = useRef(null);

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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handler: drag end - update field order
  const handleDragEnd = async (event, fieldType) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const filteredFields = fields.filter(f => f.fieldFor === fieldType);
    const oldIndex = filteredFields.findIndex(f => f.id === active.id);
    const newIndex = filteredFields.findIndex(f => f.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Reorder in local state
    const reorderedFiltered = arrayMove(filteredFields, oldIndex, newIndex);
    
    // Merge back with other field type
    const otherFields = fields.filter(f => f.fieldFor !== fieldType);
    const newFields = [...otherFields, ...reorderedFiltered];
    setFields(newFields);
    
    // Update order in database
    try {
      const updates = reorderedFiltered.map((field, index) => ({
        id: field.id,
        field_order: index
      }));
      
      for (const update of updates) {
        await supabase
          .from('lesson_template_fields')
          .update({ field_order: update.field_order })
          .eq('id', update.id);
      }
      
      console.log('✅ Field order updated in database');
    } catch (error) {
      console.error('Error updating field order:', error);
      alert('Failed to update field order. Please try again.');
    }
  };

  // Handler: Generate entire lesson (all AI-enabled fields)
  const handleGenerateLesson = async () => {
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
    setIsGeneratingLesson(true);
    setGenerationPaused(false);
    setCurrentGenerationIndex(0);
    setHighlightedMissingFields(new Set());
    
    // Get all AI-enabled fields in order: designer first, then builder
    const aiEnabledDesignerFields = fields.filter(f => f.fieldFor === 'designer' && f.aiEnabled);
    const aiEnabledBuilderFields = fields.filter(f => f.fieldFor === 'builder' && f.aiEnabled);
    const allAIFields = [...aiEnabledDesignerFields, ...aiEnabledBuilderFields];
    
    setTotalGenerationFields(allAIFields.length);
    
    // Generate all fields
    await continueGeneration();
  };

  const continueGeneration = async () => {
    const aiEnabledDesignerFields = fields.filter(f => f.fieldFor === 'designer' && f.aiEnabled);
    const aiEnabledBuilderFields = fields.filter(f => f.fieldFor === 'builder' && f.aiEnabled);
    const allAIFields = [...aiEnabledDesignerFields, ...aiEnabledBuilderFields];
    
    for (let i = currentGenerationIndex; i < allAIFields.length; i++) {
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
        alert(`Failed to generate "${field.name}": ${error.message}\n\nGeneration paused.`);
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

  const isEmptyValue = (value) => {
    if (!value) return true;
    if (typeof value === 'string') {
      const textOnly = value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
      return textOnly === '';
    }
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') {
      if (value.questions) return value.questions.every(q => isEmptyValue(q));
      return Object.keys(value).length === 0;
    }
    return false;
  };

  // Validate required context fields for a specific field
  const validateContextFieldsForField = (field, allFields, valuesToCheck = null) => {
    const missing = [];
    const currentValues = valuesToCheck || fieldValues || {};
    
    // Get AI config for this field
    let contextFieldIds = field.ai_context_field_ids || [];
    
    // Check each context field
    for (const contextFieldId of contextFieldIds) {
      const contextField = allFields.find(f => f.id === contextFieldId);
      if (!contextField) continue;

      const value = currentValues[contextFieldId];
      const isEmpty = isEmptyValue(value);
      
      if (isEmpty) {
        missing.push({
          id: contextField.id,
          name: contextField.name,
          section: contextField.fieldFor === 'designer' ? 'Designer' : 'Builder'
        });
      }
    }
    
    return missing;
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

  // Auto-save lesson after field generation
  const autoSaveLesson = async () => {
    if (!testLessonId || !lessonTypeData?.id) return;
    
    try {
      const designerFields = fields.filter(f => f.fieldFor === 'designer');
      const builderFields = fields.filter(f => f.fieldFor === 'builder');

      const designResponses = {};
      designerFields.forEach(field => {
        const value = fieldValues[field.id];
        if (field.type === 'checklist') {
          designResponses[field.name] = Array.isArray(value) ? value : [];
        } else {
          designResponses[field.name] = value || field.placeholder || '';
        }
      });
      
      const lessonResponses = {};
      builderFields.forEach(field => {
        const value = fieldValues[field.id];
        if (field.type === 'checklist') {
          lessonResponses[field.name] = Array.isArray(value) ? value : [];
        } else {
          lessonResponses[field.name] = value || field.placeholder || '';
        }
      });

      await supabase
        .from('lessons')
        .update({
          designer_responses: designResponses,
          builder_responses: lessonResponses,
          template_name: lessonTypeData.name
        })
        .eq('id', testLessonId);
      
      console.log('✅ Auto-saved after field generation');
    } catch (error) {
      console.error('Error auto-saving:', error);
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

      // Add default vocab standards context when using CCSS
      if (defaultStandardFramework === 'CCSS') {
        const gradeField = fields.find(f => f.type === 'grade_band_selector');
        const gradeValue = gradeField ? storedFieldValues[gradeField.id] : null;
        const gradeLevel = extractGradeFromBand(gradeValue);
        const vocabStandards = await getCcssVocabularyStandardsForGrade(gradeLevel);
        if (vocabStandards.length > 0) {
          aiConfig.extraContextBlocks = [
            {
              title: 'Grade-Specific Vocabulary Standards (CCSS)',
              content: vocabStandards.join('; ')
            }
          ];
          console.log('📚 Vocab standards added to MCQ prompt (individual):', vocabStandards);
        }
      } else {
        const gradeField = fields.find(f => f.type === 'grade_band_selector');
        const gradeValue = gradeField ? storedFieldValues[gradeField.id] : null;
        const gradeLevel = extractGradeFromBand(gradeValue);
        const vocabStandards = await getMappedVocabularyStandardsForGrade(gradeLevel, defaultStandardFramework);
        if (vocabStandards.length > 0) {
          aiConfig.extraContextBlocks = [
            {
              title: `Grade-Specific Vocabulary Standards (${defaultStandardFramework})`,
              content: vocabStandards.join('; ')
            }
          ];
          console.log('📚 Vocab standards added to MCQ prompt (individual):', vocabStandards);
        }
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
      
      // Extract grade level from fieldValues
      const gradeField = fields.find(f => f.type === 'grade_band_selector');
      const gradeValue = gradeField ? fieldValues[gradeField.id] : null;
      const gradeLevel = extractGradeFromBand(gradeValue);
      
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
        const mappingResult = await getMappedStandardsWithSource(selectedStandard.fullCode, gradeLevel);
        standardsText = mappingResult.mappedStandards || standardsText;
        sourceStandardInfo = mappingResult.sourceStandard;
        
        // Get candidate standards for filtering (excluding source standard)
        candidateStandards = standardsText
          .split(';')
          .map(s => s.trim())
          .filter(s => s && s !== mappingResult.sourceStandard?.code);
      } else if (q.standards && q.standards.length > 0) {
        const firstStandard = q.standards[0];
        const mappingResult = await getMappedStandardsWithSource(firstStandard, gradeLevel);
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
      alert(`Failed to generate question: ${error.message}`);
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
        
        // Find Content ID field in designer responses
        const contentIdField = fields.find(f => f.name === 'Content ID' && f.fieldFor === 'designer');
        const contentId = contentIdField ? storedFieldValues[contentIdField.id] : null;
        
        if (!contentId) {
          throw new Error('Content ID field not found. Please fill in the Content ID field first.');
        }
        
        // Get template name
        const templateName = lessonTypeData?.name || 'unknown-template';
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
          const designerFields = fields.filter(f => f.fieldFor === 'designer');
          const builderFields = fields.filter(f => f.fieldFor === 'builder');
          
          const updatedFieldValues = { ...storedFieldValues, [field.id]: imageFieldValue };
          
          const designResponses = {};
          designerFields.forEach(f => {
            const value = updatedFieldValues[f.id];
            if (f.type === 'image') {
              designResponses[f.name] = value || { url: '', altText: '', description: '', imageModel: '', altTextModel: '' };
            } else {
              designResponses[f.name] = value || f.placeholder || '';
            }
          });
          
          const lessonResponses = {};
          builderFields.forEach(f => {
            const value = updatedFieldValues[f.id];
            if (f.type === 'image') {
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
        const gradeLevel = extractGradeFromBand(gradeValue);

        // Resolve default vocab standards when using CCSS
        const vocabStandards = defaultStandardFramework === 'CCSS'
          ? await getCcssVocabularyStandardsForGrade(gradeLevel)
          : await getMappedVocabularyStandardsForGrade(gradeLevel, defaultStandardFramework);
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
            const mappingResult = await getMappedStandardsWithSource(firstStandard, gradeLevel);
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
        generatedContent = await callAIWithBatchedContext(prompt, selectedModel, 4096);
      }
      
      console.log('Generated content:', generatedContent);

      // Update the field value
      setFieldValues(prev => ({ ...prev, [field.id]: generatedContent }));
      setHasGeneratedMap(prev => ({ ...prev, [field.id]: true }));
      
    } catch (error) {
      console.error('Error generating AI content:', error);
      alert(`Failed to generate content: ${error.message}`);
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
      alert('Failed to load lesson template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyDefaultStandardFramework = async (framework) => {
    if (!lessonTypeData?.id) {
      alert('Please save the lesson template first.');
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
      alert('Failed to update default standard framework. Please try again.');
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


  const handleFieldAdded = async (fieldData, isEdit) => {
    if (!lessonTypeData?.id) return;

    try {
      if (isEdit) {
        // Update existing field in database
        const fieldConfig = {};
        if (fieldData.options) fieldConfig.options = fieldData.options;
        if (fieldData.min_selections !== undefined) fieldConfig.min_selections = fieldData.min_selections;
        if (fieldData.max_selections !== undefined) fieldConfig.max_selections = fieldData.max_selections;
        if (fieldData.framework) fieldConfig.framework = fieldData.framework;
        
        const updateData = {
          field_type: fieldData.type,
          name: fieldData.name,
          placeholder_text: fieldData.placeholder,
          helper_text: fieldData.helperText,
          required: fieldData.required,
          ai_enabled: fieldData.aiEnabled,
          required_for_generation: fieldData.requiredForGeneration,
          field_for: fieldData.fieldFor,
          field_config: Object.keys(fieldConfig).length > 0 ? fieldConfig : null
        };
        
        const { error } = await supabase
          .from('lesson_template_fields')
          .update(updateData)
          .eq('id', fieldData.id);
        
        if (error) throw error;
        
        setFields(fields.map(f => f.id === fieldData.id ? fieldData : f));
      } else {
        // Insert new field into database
        const fieldConfig = {};
        if (fieldData.options) fieldConfig.options = fieldData.options;
        if (fieldData.min_selections !== undefined) fieldConfig.min_selections = fieldData.min_selections;
        if (fieldData.max_selections !== undefined) fieldConfig.max_selections = fieldData.max_selections;
        if (fieldData.framework) fieldConfig.framework = fieldData.framework;
        
        const insertData = {
          lesson_template_id: lessonTypeData.id,
          field_type: fieldData.type,
          name: fieldData.name,
          placeholder_text: fieldData.placeholder,
          helper_text: fieldData.helperText,
          required: fieldData.required,
          ai_enabled: fieldData.aiEnabled,
          required_for_generation: fieldData.requiredForGeneration,
          field_for: fieldData.fieldFor,
          field_order: fields.length,
          field_config: Object.keys(fieldConfig).length > 0 ? fieldConfig : null
        };
        
        const { data: newField, error } = await supabase
          .from('lesson_template_fields')
          .insert(insertData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update local state with database ID
        setFields([...fields, { ...fieldData, id: newField.id }]);
      }
      
      // Update the lesson template's updated_at timestamp
      const { error: updateError } = await supabase
        .from('lesson_templates')
        .update({
          updated_at: new Date().toISOString(),
          updated_by: session?.user?.id
        })
        .eq('id', lessonTypeData.id);
      
      if (updateError) {
        console.error('Error updating lesson template timestamp:', updateError);
      }
    } catch (error) {
      console.error('Error saving field:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      alert(`Failed to save field: ${error.message || 'Please try again.'}`);
    }
    
    setEditingField(null);
  };

  const handleEditField = (field) => {
    setEditingField(field);
    setIsModalOpen(true);
  };

  const handleDeleteField = async (fieldId) => {
    if (!lessonTypeData?.id) return;

    try {
      const { error } = await supabase
        .from('lesson_template_fields')
        .delete()
        .eq('id', fieldId);
      
      if (error) throw error;
      
      setFields(fields.filter(f => f.id !== fieldId));
      
      // Update the lesson template's updated_at timestamp
      const { error: updateError } = await supabase
        .from('lesson_templates')
        .update({
          updated_at: new Date().toISOString(),
          updated_by: session?.user?.id
        })
        .eq('id', lessonTypeData.id);
      
      if (updateError) {
        console.error('Error updating lesson template timestamp:', updateError);
      }
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Failed to delete field. Please try again.');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingField(null);
  };

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
      
      // Generate markdown export file for the new template
      try {
        // Import the utility functions dynamically
        const { 
          templateNameToCamelCase, 
          generateMarkdownExportFileContent,
          generateImportStatement,
          generateMapEntry
        } = await import('../../lib/generateMarkdownExportFile.js');
        
        const camelCaseName = templateNameToCamelCase(data.name);
        const fileName = `${camelCaseName}MarkdownExport.js`;
        const fileContent = generateMarkdownExportFileContent(data.name);
        const importStatement = generateImportStatement(data.name);
        const mapEntry = generateMapEntry(data.name);
        
        // Show modal with instructions
        setMarkdownExportData({
          fileName,
          filePath: `src/lib/markdown-export/${fileName}`,
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
      alert('Failed to create lesson template. Please try again.');
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
      alert('Please save the lesson template first.');
      return;
    }

    // Get all designer and builder fields
    const designerFields = fields.filter(f => f.fieldFor === 'designer');
    const builderFields = fields.filter(f => f.fieldFor === 'builder');

    // Collect design responses from actual field values
    const designResponses = {};
    designerFields.forEach(field => {
      const value = fieldValues[field.id];
      // For image fields, save the full object with url, altText, etc.
      if (field.type === 'image') {
        designResponses[field.name] = value || { url: '', altText: '', description: '', imageModel: '', altTextModel: '' };
      } else {
        // Use actual entered value, or fallback to placeholder or empty string
        designResponses[field.name] = value || field.placeholder || '';
      }
    });
    
    // Collect lesson responses from builder field values
    const lessonResponses = {};
    builderFields.forEach(field => {
      const value = fieldValues[field.id];
      // For image fields, save the full object with url, altText, etc.
      if (field.type === 'image') {
        lessonResponses[field.name] = value || { url: '', altText: '', description: '', imageModel: '', altTextModel: '' };
      } else {
        lessonResponses[field.name] = value || field.placeholder || '';
      }
    });

    try {
      let data, error;
      
      if (testLessonId) {
        // Try to update existing test lesson
        const result = await supabase
          .from('lessons')
          .update({
            designer_responses: designResponses,
            builder_responses: lessonResponses,
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
              designer_responses: designResponses,
              builder_responses: lessonResponses,
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
            designer_responses: designResponses,
            builder_responses: lessonResponses,
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
      alert('Failed to save test lesson. Please try again.');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ color: 'var(--gray-600)', fontSize: '1.125rem' }}>
          Loading lesson template...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem 1rem 4rem'
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto'
      }}>
        {/* Page Header */}
        <div style={{
          position: 'relative',
          marginBottom: '2.5rem'
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
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
                <span style={{
                  display: 'inline-block',
                  padding: '0.375rem 0.875rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  backdropFilter: 'blur(8px)'
                }}>
                  {US_STATES.find(s => s.value === lessonTypeData.state)?.label || lessonTypeData.state}
                </span>
              )}
              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                color: '#fff',
                margin: 0
              }}>
                {lessonTypeData?.name || 'Create New Lesson Template'}
              </h1>
            </div>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1.125rem',
              fontWeight: 500,
              marginBottom: 0
            }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* AI Model with Label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-500)' }}> 🤖 AI Model</span>
              <div style={{ position: 'relative' }}>
                <button
                  ref={modelButtonRef}
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    background: '#fff',
                    color: 'var(--gray-700)',
                    border: '1px solid var(--gray-300)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    minWidth: '130px',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{selectedModel === 'claude-sonnet-4-20250514' ? 'Claude Sonnet 4' : 'GPT-4o'}</span>
                  <ChevronDown size={14} style={{ transform: showModelDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                </button>
                {showModelDropdown && modelButtonRef.current && createPortal(
                  <>
                    {/* Invisible overlay to close dropdown when clicking outside */}
                    <div 
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 99998
                      }}
                      onClick={() => setShowModelDropdown(false)}
                    />
                    <div style={{
                      position: 'fixed',
                      top: modelButtonRef.current.getBoundingClientRect().bottom + 4,
                      left: modelButtonRef.current.getBoundingClientRect().left,
                      width: 150,
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                      zIndex: 99999,
                      overflow: 'hidden'
                    }}>
                      {['claude-sonnet-4-20250514', 'gpt-4o'].map(model => (
                        <button
                          key={model}
                          onClick={() => {
                            setSelectedModel(model);
                            setShowModelDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            background: selectedModel === model ? '#f3f4f6' : '#fff',
                            color: '#374151',
                            fontSize: '0.8125rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedModel === model ? '#f3f4f6' : '#fff'}
                        >
                          {model === 'claude-sonnet-4-20250514' ? '🤖 Claude Sonnet 4' : '🤖 GPT-4o'}
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body
                )}
              </div>
            </div>

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
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                background: isGeneratingLesson 
                  ? 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.875rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: isGeneratingLesson ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)',
                opacity: isGeneratingLesson ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isGeneratingLesson) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isGeneratingLesson) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.3)';
                }
              }}
            >
              <Sparkles size={16} />
              {isGeneratingLesson 
                ? `Generating (${currentGenerationIndex + 1}/${totalGenerationFields})...`
                : generationPaused 
                  ? 'Continue Generating Lesson'
                  : 'Generate Lesson'}
            </button>

            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--gray-300)' }} />

            <button
              onClick={handleSaveTestLesson}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.875rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.3)';
              }}
            >
              <Beaker size={16} />
              Save Test Lesson
            </button>
            
            <button
              onClick={handleSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.875rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
              }}
            >
              <Save size={16} />
              Save Template
            </button>
          </div>


        </div>

        {/* Fields Card */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem',
          minHeight: '500px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          
          {/* Required field indicator */}
          {fields.some(f => f.required) && (
            <div style={{
              textAlign: 'right',
              marginBottom: '1rem',
              fontSize: '0.75rem',
              color: '#ef4444',
              fontStyle: 'italic'
            }}>
              * Required field
            </div>
          )}
          
          {/* Fields List */}
          <div style={{
            display: layoutMode === 'side-by-side' ? 'grid' : 'flex',
            gridTemplateColumns: layoutMode === 'side-by-side' ? '1fr 1fr' : undefined,
            flexDirection: layoutMode === 'stacked' ? 'column' : undefined,
            gap: layoutMode === 'side-by-side' ? '2rem' : '2.5rem'
          }}>
            {/* Designer Fields Section */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '2px solid var(--gray-200)',
                minHeight: '3rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--gray-900)',
                    margin: 0
                  }}>
                    Designer Field{fields.filter(f => f.fieldFor === 'designer').length === 1 ? '' : 's'}
                  </h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#dbeafe',
                    color: 'var(--primary)',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {fields.filter(f => f.fieldFor === 'designer').length}
                  </span>
                </div>
                {/* Show controls only in stacked mode or left side in side-by-side */}
                {layoutMode === 'stacked' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Add Field Button */}
                  <button
                    onClick={() => {
                      setEditingField(null);
                      setIsModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                      color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.5rem 0.875rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                      }}
                    >
                      <Plus size={16} />
                      Add Field
                    </button>
                    
                    {/* Layout Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-500)' }}>Layout</span>
                      <div style={{
                        display: 'flex',
                        backgroundColor: 'var(--gray-100)',
                        borderRadius: '8px',
                        padding: '3px'
                      }}>
                        <button
                          onClick={() => setLayoutMode('stacked')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.375rem 0.625rem',
                            border: 'none',
                            borderRadius: '6px',
                            background: layoutMode === 'stacked' ? '#fff' : 'transparent',
                            color: layoutMode === 'stacked' ? 'var(--primary)' : 'var(--gray-500)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: layoutMode === 'stacked' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                          }}
                          title="Stack fields vertically"
                        >
                          <Rows3 size={14} />
                        </button>
                        <button
                          onClick={() => setLayoutMode('side-by-side')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.375rem 0.625rem',
                            border: 'none',
                            borderRadius: '6px',
                            background: layoutMode === 'side-by-side' ? '#fff' : 'transparent',
                            color: layoutMode === 'side-by-side' ? 'var(--primary)' : 'var(--gray-500)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: layoutMode === 'side-by-side' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                          }}
                          title="Show fields side by side"
                        >
                          <Columns2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {fields.filter(f => f.fieldFor === 'designer').length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'var(--gray-400)',
                    fontSize: '0.875rem'
                  }}>
                    No designer fields added yet
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, 'designer')}
                  >
                    <SortableContext
                      items={fields.filter(f => f.fieldFor === 'designer').map(f => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        paddingLeft: '2rem'
                      }}>
                        {fields.filter(f => f.fieldFor === 'designer').map((field) => {
                          const aiProps = field.aiEnabled ? {
                            onGenerateAI: handleGenerateAI,
                            onAIConfig: handleAIConfig,
                            isGenerating: generatingFieldId === field.id,
                            hasGenerated: !!hasGeneratedMap[field.id],
                          } : {};
                          
                          // Check if this field is missing
                          const isMissing = highlightedMissingFields.has(field.id);
                          
                          let fieldComponent;
                          if (field.type === 'text') {
                            fieldComponent = (
                              <TextField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || ''}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'rich_text') {
                            fieldComponent = (
                              <RichTextField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || ''}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'grade_band_selector' || field.type === 'theme_selector' || field.type === 'dropdown') {
                            fieldComponent = (
                              <DropdownField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || ''}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'checklist') {
                            fieldComponent = (
                              <ChecklistField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || []}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'image') {
                            fieldComponent = (
                              <ImageField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || { description: '', url: '', altText: '', imageModel: '', altTextModel: '' }}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'assign_standards') {
                            fieldComponent = (
                              <AssignStandardsField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || []}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'mcqs') {
                            // Extract question labels from ai_question_prompts for display (designer)
                            const questionLabelsD = {};
                            if (field.ai_question_prompts) {
                              ['q1', 'q2', 'q3', 'q4', 'q5'].forEach(qKey => {
                                const qData = field.ai_question_prompts[qKey];
                                if (qData) {
                                  questionLabelsD[qKey] = {
                                    label: typeof qData === 'string' ? null : qData.label,
                                    tooltip: typeof qData === 'string' ? null : qData.tooltip
                                  };
                                }
                              });
                            }
                            
                            fieldComponent = (
                              <MCQsField
                                key={field.id}
                                field={{ ...field, questionLabels: questionLabelsD }}
                                value={fieldValues[field.id] || { questions: ['', '', '', '', ''] }}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                onAIGenerate={field.aiEnabled ? () => handleGenerateAI(field) : undefined}
                                onGenerateIndividual={field.aiEnabled ? handleGenerateIndividualMCQ : undefined}
                                onAIConfig={handleAIConfig}
                                isMissing={isMissing}
                                defaultStandardFramework={defaultStandardFramework}
                              />
                            );
                          } else {
                            fieldComponent = (
                              <BaseField
                                key={field.id}
                                field={field}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          }
                          
                          return (
                            <SortableField key={field.id} id={field.id}>
                              {fieldComponent}
                            </SortableField>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              {/* Builder Fields Section */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid var(--gray-200)',
                  minHeight: '3rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      color: 'var(--gray-900)',
                      margin: 0
                    }}>
                      Builder Field{fields.filter(f => f.fieldFor === 'builder').length === 1 ? '' : 's'}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#dbeafe',
                      color: 'var(--primary)',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {fields.filter(f => f.fieldFor === 'builder').length}
                    </span>
                  </div>
                  {/* Show controls in side-by-side mode */}
                  {layoutMode === 'side-by-side' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Add Field Button */}
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setIsModalOpen(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.5rem 0.875rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                        }}
                      >
                        <Plus size={16} />
                        Add Field
                      </button>
                      
                      {/* Layout Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-500)' }}>Layout</span>
                        <div style={{
                          display: 'flex',
                          backgroundColor: 'var(--gray-100)',
                          borderRadius: '8px',
                          padding: '3px'
                        }}>
                          <button
                            onClick={() => setLayoutMode('stacked')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.375rem 0.625rem',
                              border: 'none',
                              borderRadius: '6px',
                              background: layoutMode === 'stacked' ? '#fff' : 'transparent',
                              color: layoutMode === 'stacked' ? 'var(--primary)' : 'var(--gray-500)',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: layoutMode === 'stacked' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                            title="Stack fields vertically"
                          >
                            <Rows3 size={14} />
                          </button>
                          <button
                            onClick={() => setLayoutMode('side-by-side')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.375rem 0.625rem',
                              border: 'none',
                              borderRadius: '6px',
                              background: layoutMode === 'side-by-side' ? '#fff' : 'transparent',
                              color: layoutMode === 'side-by-side' ? 'var(--primary)' : 'var(--gray-500)',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: layoutMode === 'side-by-side' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                            title="Show fields side by side"
                          >
                            <Columns2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {fields.filter(f => f.fieldFor === 'builder').length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'var(--gray-400)',
                    fontSize: '0.875rem'
                  }}>
                    No builder fields added yet
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, 'builder')}
                  >
                    <SortableContext
                      items={fields.filter(f => f.fieldFor === 'builder').map(f => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        paddingLeft: '2rem'
                      }}>
                        {fields.filter(f => f.fieldFor === 'builder').map((field) => {
                          const aiProps = field.aiEnabled ? {
                            onGenerateAI: handleGenerateAI,
                            onAIConfig: handleAIConfig,
                            isGenerating: generatingFieldId === field.id,
                            hasGenerated: !!hasGeneratedMap[field.id],
                          } : {};
                          
                          // Check if this field is missing
                          const isMissing = highlightedMissingFields.has(field.id);
                          
                          let fieldComponent;
                          if (field.type === 'text') {
                            fieldComponent = (
                              <TextField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || ''}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'rich_text') {
                            fieldComponent = (
                              <RichTextField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || ''}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'grade_band_selector' || field.type === 'theme_selector' || field.type === 'dropdown') {
                            fieldComponent = (
                              <DropdownField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || ''}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'checklist') {
                            fieldComponent = (
                              <ChecklistField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || []}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'image') {
                            fieldComponent = (
                              <ImageField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || { description: '', url: '', altText: '', imageModel: '', altTextModel: '' }}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'assign_standards') {
                            fieldComponent = (
                              <AssignStandardsField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || []}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'mcqs') {
                            // Extract question labels from ai_question_prompts for display (builder)
                            const questionLabelsB = {};
                            if (field.ai_question_prompts) {
                              ['q1', 'q2', 'q3', 'q4', 'q5'].forEach(qKey => {
                                const qData = field.ai_question_prompts[qKey];
                                if (qData) {
                                  questionLabelsB[qKey] = {
                                    label: typeof qData === 'string' ? null : qData.label,
                                    tooltip: typeof qData === 'string' ? null : qData.tooltip
                                  };
                                }
                              });
                            }
                            
                            fieldComponent = (
                              <MCQsField
                                key={field.id}
                                field={{ ...field, questionLabels: questionLabelsB }}
                                value={fieldValues[field.id] || { questions: ['', '', '', '', ''] }}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                onAIGenerate={field.aiEnabled ? () => handleGenerateAI(field) : undefined}
                                onGenerateIndividual={field.aiEnabled ? handleGenerateIndividualMCQ : undefined}
                                onAIConfig={handleAIConfig}
                                isMissing={isMissing}
                                defaultStandardFramework={defaultStandardFramework}
                              />
                            );
                          } else {
                            fieldComponent = (
                              <BaseField
                                key={field.id}
                                field={field}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          }
                          
                          return (
                            <SortableField key={field.id} id={field.id}>
                              {fieldComponent}
                            </SortableField>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showSaveToast && (
        <div style={{
          position: 'fixed',
          top: '5rem',
          right: '2rem',
          background: 'linear-gradient(135deg, #ecfeff 0%, #eef2ff 100%)',
          color: '#1e293b',
          border: '1px solid #c7d2fe',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 12px 30px rgba(30, 41, 59, 0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '1rem',
          fontWeight: 600,
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <Check size={20} />
          Lesson template saved successfully!
        </div>
      )}

      {/* Test Lesson Toast Notification */}
      {showTestLessonToast && (
        <div style={{
          position: 'fixed',
          top: '5rem',
          right: '2rem',
          background: 'linear-gradient(135deg, #ecfeff 0%, #eef2ff 100%)',
          color: '#1e293b',
          border: '1px solid #c7d2fe',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 12px 30px rgba(30, 41, 59, 0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '1rem',
          fontWeight: 600,
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <Check size={20} />
          Test lesson saved successfully!
        </div>
      )}

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
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
                      alert('File content copied to clipboard!');
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
                      alert('Import statement copied!');
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
                      alert('Map entry copied!');
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
