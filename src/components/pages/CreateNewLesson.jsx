import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Save, Check, Beaker, ArrowLeft, Sparkles, Columns2, Rows3, ChevronDown, GripVertical } from 'lucide-react';
import { useSearchParams, useOutletContext, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddEditFieldModal from '../modals/AddFieldModal';
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
import { callAI, callAIWithFunction, generateImage, generateAltText } from '../../lib/aiClient';
import gradeRangeConfig from '../../config/gradeRangeOptions.json';
import themeSelectorConfig from '../../config/themeSelectorOptions.json';

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
            color: '#8b5cf600',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#6d28d900'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8b5cf600'}
          title="Drag to reorder"
        >
          <GripVertical size={20} />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CreateNewLesson() {
  const [searchParams] = useSearchParams();
  const { session, profile } = useOutletContext() || {};
  const navigate = useNavigate();
  const templateId = searchParams.get('templateId');
  const urlLessonId = searchParams.get('lessonId');
  const [currentLessonId, setCurrentLessonId] = useState(urlLessonId);
  const lessonId = currentLessonId || urlLessonId;
  const [templateData, setTemplateData] = useState(null);
  const [fields, setFields] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [fieldValues, setFieldValues] = useState({});
  const [layoutMode, setLayoutMode] = useState('side-by-side'); // 'stacked' or 'side-by-side'
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelButtonRef = useRef(null);

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

  // Handler: open AI config modal
  const handleAIConfig = (field) => {
    setAIConfigField(field);
  };

  // Handler: close AI config modal
  const handleAIConfigClose = () => {
    setAIConfigField(null);
  };

  // Handler: save AI config - implements snapshot system for lesson-specific configs
  const handleAIConfigSave = async (config) => {
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
      setAIConfigField(null);
    } catch (error) {
      console.error('Error saving lesson AI config:', error);
      alert('Failed to save AI configuration. Please try again.');
    }
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
          .select('ai_prompt, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
          .eq('id', field.id)
          .single();
        
        if (error) throw new Error('Failed to load AI configuration');
        fieldAIConfig = fieldData;
      }
      
      // Get field values from localStorage
      const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
      
      // Build prompt for single question
      const aiConfig = {
        systemInstructions: fieldAIConfig.ai_system_instructions || '',
        prompt: fieldAIConfig.ai_prompt?.replace('Generate 5 multiple choice questions', 'Generate 1 multiple choice question') || '',
        formatRequirements: fieldAIConfig.ai_format_requirements || '',
        contextInstructions: fieldAIConfig.ai_context_instructions || '',
        selectedFieldIds: fieldAIConfig.ai_context_field_ids || [],
        allFields: fields,
        fieldValues: storedFieldValues
      };
      
      // Add selected standard to context if provided
      if (selectedStandard) {
        aiConfig.prompt += `\n\nUSE THIS SPECIFIC STANDARD:\nStandard Code: ${selectedStandard.fullCode}\nStandard Statement: ${selectedStandard.statement}`;
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
      
      // Format the structured response as text
      const q = result.questions[0];
      const formattedMCQ = `${q.question_text}\nA. ${q.choices.A}\nB. ${q.choices.B}\nC. ${q.choices.C}\nD. ${q.choices.D}\n[${q.standards.join('; ')}]\nKEY: ${q.correct_answer}`;
      
      // Update only the specific question in the array
      setFieldValues(prev => {
        const currentValue = prev[fieldId] || { questions: ['', '', '', '', ''] };
        const updatedQuestions = [...(currentValue.questions || ['', '', '', '', ''])];
        updatedQuestions[questionIndex] = formattedMCQ;
        
        return {
          ...prev,
          [fieldId]: { questions: updatedQuestions }
        };
      });
      
      setHasGeneratedMap(prev => ({ ...prev, [fieldId]: true }));
    } catch (error) {
      console.error('Error generating individual MCQ:', error);
      alert(`Failed to generate question: ${error.message}`);
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
    
    // Validate required fields before starting
    const missing = validateRequiredFields(allAIFields);
    if (missing.length > 0) {
      setMissingFields(missing);
      setShowMissingFieldsModal(true);
      setGenerationPaused(true);
      
      // Highlight missing fields
      const missingIds = new Set(missing.map(m => m.id));
      setHighlightedMissingFields(missingIds);
      setIsGeneratingLesson(false);
      return;
    }
    
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
      
      // Validate context fields before generating this field
      const missing = validateContextFieldsForField(field, allAIFields);
      if (missing.length > 0) {
        setMissingFields(missing);
        setShowMissingFieldsModal(true);
        setGenerationPaused(true);
        
        // Highlight missing fields
        const missingIds = new Set(missing.map(m => m.id));
        setHighlightedMissingFields(missingIds);
        setIsGeneratingLesson(false);
        return;
      }
      
      // Generate the field
      try {
        await handleGenerateAI(field);
        
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

  // Validate required context fields for a specific field
  const validateContextFieldsForField = (field, allFields) => {
    const missing = [];
    const currentValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
    
    // Get AI config for this field
    let contextFieldIds = field.ai_context_field_ids || [];
    
    // Check if lesson has user_ai_config override
    if (lessonId) {
      // Would need to fetch from DB, but for now use field's config
      // In practice, this should check lessonData.user_ai_config[field.id]
    }
    
    // Check each context field
    for (const contextFieldId of contextFieldIds) {
      const contextField = allFields.find(f => f.id === contextFieldId);
      if (!contextField) continue;
      
      const value = currentValues[contextFieldId];
      const isEmpty = !value || 
                      (typeof value === 'string' && value.trim() === '') ||
                      (Array.isArray(value) && value.length === 0) ||
                      (typeof value === 'object' && value.questions && value.questions.every(q => !q || q.trim() === ''));
      
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
  const validateRequiredFields = (aiFields) => {
    const missing = [];
    const currentValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
    
    // Get all unique context field IDs from all AI fields
    const allContextFieldIds = new Set();
    aiFields.forEach(field => {
      const contextIds = field.ai_context_field_ids || [];
      contextIds.forEach(id => allContextFieldIds.add(id));
    });
    
    // Check each required context field
    for (const contextFieldId of allContextFieldIds) {
      const contextField = fields.find(f => f.id === contextFieldId);
      if (!contextField) continue;
      
      // Only validate if field is marked as requiredForGeneration
      if (!contextField.requiredForGeneration) continue;
      
      const value = currentValues[contextFieldId];
      const isEmpty = !value || 
                      (typeof value === 'string' && value.trim() === '') ||
                      (Array.isArray(value) && value.length === 0) ||
                      (typeof value === 'object' && value.questions && value.questions.every(q => !q || q.trim() === ''));
      
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

  // Auto-save lesson after field generation
  const autoSaveLesson = async () => {
    if (!lessonId || !templateData?.id) return;
    
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
          template_name: templateData.name
        })
        .eq('id', lessonId);
      
      console.log('✅ Auto-saved after field generation');
    } catch (error) {
      console.error('Error auto-saving:', error);
    }
  };

  // Handler: trigger AI generation
  const handleGenerateAI = async (field) => {
    try {
      setGeneratingFieldId(field.id);
      
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

        // Build the prompt using the shared function
        const imagePrompt = buildFullPrompt(aiConfig);
        
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
          description: ''
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
        console.log('🎯 Using function calling for MCQs field');
        
        // Use function calling for structured output
        const functionSchema = {
          name: 'generate_mcqs',
          description: 'Generate 5 multiple choice questions with answer choices, standards, and answer keys',
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
                minItems: 5,
                maxItems: 5
              }
            },
            required: ['questions']
          }
        };
        
        const result = await callAIWithFunction(prompt, selectedModel, functionSchema);
        console.log('✅ MCQs generated (structured):', result);
        
        // Format each question as text and store in questions array
        const formattedQuestions = result.questions.map((q, i) => 
          `${i + 1}. ${q.question_text}\nA. ${q.choices.A}\nB. ${q.choices.B}\nC. ${q.choices.C}\nD. ${q.choices.D}\n[${q.standards.join('; ')}]\nKEY: ${q.correct_answer}`
        );
        
        generatedContent = { questions: formattedQuestions };
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
      
    } catch (error) {
      console.error('Error generating AI content:', error);
      alert(`Failed to generate content: ${error.message}`);
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
    localStorage.setItem('fieldValues', JSON.stringify(fieldValues));
  }, [fieldValues]);

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
        }
        
        return mappedField;
      });
      
      console.log('🔍 Loaded fields:', mappedFields);
      console.log('🔍 Designer fields with required_for_generation:', 
        mappedFields.filter(f => f.fieldFor === 'designer' && f.requiredForGeneration === true)
      );
      
      setFields(mappedFields);
      
      // Load existing lesson if lessonId is provided
      if (lessonId) {
        const { data: lesson, error: lessonError } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', lessonId)
          .single();
        
        if (lessonError) {
          console.error('Error loading lesson:', lessonError);
        } else if (lesson) {
          // Load existing field values from designer_responses and builder_responses
          const loadedValues = {};
          mappedFields.forEach(field => {
            if (field.fieldFor === 'designer' && lesson.designer_responses?.[field.name]) {
              loadedValues[field.id] = lesson.designer_responses[field.name];
            } else if (field.fieldFor === 'builder' && lesson.builder_responses?.[field.name]) {
              loadedValues[field.id] = lesson.builder_responses[field.name];
            }
          });
          setFieldValues(loadedValues);
        }
      }
    } catch (error) {
      console.error('Error loading lesson template:', error);
      alert('Failed to load lesson template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldAdded = async (fieldData, isEdit) => {
    if (!templateData?.id) return;

    try {
      if (isEdit) {
        // Update existing field in database
        const updateData = {
          field_type: fieldData.type,
          name: fieldData.name,
          placeholder_text: fieldData.placeholder,
          helper_text: fieldData.helperText,
          required: fieldData.required,
          ai_enabled: fieldData.aiEnabled,
          required_for_generation: fieldData.requiredForGeneration,
          field_for: fieldData.fieldFor
        };
        
        const { error } = await supabase
          .from('lesson_template_fields')
          .update(updateData)
          .eq('id', fieldData.id);
        
        if (error) throw error;
        
        setFields(fields.map(f => f.id === fieldData.id ? fieldData : f));
      } else {
        // Insert new field into database
        const insertData = {
          lesson_template_id: templateData.id,
          field_type: fieldData.type,
          name: fieldData.name,
          placeholder_text: fieldData.placeholder,
          helper_text: fieldData.helperText,
          required: fieldData.required,
          ai_enabled: fieldData.aiEnabled,
          required_for_generation: fieldData.requiredForGeneration,
          field_for: fieldData.fieldFor,
          field_order: fields.length
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
        .eq('id', templateData.id);
      
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
    if (!templateData?.id) return;

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
        .eq('id', templateData.id);
      
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

  const handleSave = async () => {
    if (!templateData?.id) {
      alert('No template selected.');
      return;
    }
    
    // Create lesson if it doesn't exist yet
    if (!lessonId) {
      try {
        // Get designer fields to save initial responses
        const designerFields = fields.filter(f => f.fieldFor === 'designer');
        const designResponses = {};
        designerFields.forEach(field => {
          const value = fieldValues[field.id];
          // For checklist fields, ensure array; for image fields, ensure object; for others, use value or empty string
          if (field.type === 'checklist') {
            designResponses[field.name] = Array.isArray(value) ? value : [];
          } else if (field.type === 'image') {
            designResponses[field.name] = value || { description: '', url: '', altText: '', imageModel: '', altTextModel: '' };
          } else {
            designResponses[field.name] = value || '';
          }
        });
        
        // Create new lesson
        const { data, error } = await supabase
          .from('lessons')
          .insert({
            lesson_template_id: templateData.id,
            template_name: templateData.name,
            is_test: false,
            status: 'draft',
            designer_responses: designResponses,
            builder_responses: {},
            created_by: session?.user?.id
          })
          .select()
          .single();
        
        if (error) throw error;
        
        console.log('✅ Lesson created:', data);
        
        // Update state with the new lesson ID
        setCurrentLessonId(data.id);
        
        // Update URL with new lessonId
        navigate(`/create-new-lesson?templateId=${templateData.id}&lessonId=${data.id}`, { replace: true });
        
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 3000);
        return;
      } catch (error) {
        console.error('Error creating lesson:', error);
        alert('Failed to create lesson. Please try again.');
        return;
      }
    }

    try {
      // Get all designer and builder fields
      const designerFields = fields.filter(f => f.fieldFor === 'designer');
      const builderFields = fields.filter(f => f.fieldFor === 'builder');

      // Collect design responses from actual field values
      const designResponses = {};
      designerFields.forEach(field => {
        const value = fieldValues[field.id];
        if (field.type === 'checklist') {
          designResponses[field.name] = Array.isArray(value) ? value : [];
        } else if (field.type === 'image') {
          designResponses[field.name] = value || { description: '', url: '', altText: '', imageModel: '', altTextModel: '' };
        } else {
          designResponses[field.name] = value || '';
        }
      });
      
      // Collect lesson responses from builder field values
      const lessonResponses = {};
      builderFields.forEach(field => {
        const value = fieldValues[field.id];
        if (field.type === 'checklist') {
          lessonResponses[field.name] = Array.isArray(value) ? value : [];
        } else if (field.type === 'image') {
          lessonResponses[field.name] = value || { description: '', url: '', altText: '', imageModel: '', altTextModel: '' };
        } else {
          lessonResponses[field.name] = value || '';
        }
      });

      // Update lesson
      const { error } = await supabase
        .from('lessons')
        .update({
          designer_responses: designResponses,
          builder_responses: lessonResponses,
          template_name: templateData.name
        })
        .eq('id', lessonId);

      if (error) throw error;

      console.log('✅ Lesson saved successfully');
      
      // Show toast notification
      setShowSaveToast(true);
      
      // Hide toast after delay
      setTimeout(() => {
        setShowSaveToast(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert('Failed to save lesson. Please try again.');
    }
  };

  const handleSaveLesson = async () => {
    if (!templateData?.id) {
      alert('Please save the lesson template first.');
      return;
    }

    // Get all designer and builder fields
    const designerFields = fields.filter(f => f.fieldFor === 'designer');
    const builderFields = fields.filter(f => f.fieldFor === 'builder');

    // Helper function to upload data URLs to storage
    const uploadDataUrlIfNeeded = async (value, fieldName) => {
      if (value && typeof value === 'object' && value.url && value.url.startsWith('data:image')) {
        console.log('🔄 Uploading data URL for field:', fieldName);
        const contentId = fieldValues[designerFields.find(f => f.name === 'Content ID')?.id] || `lesson-${Date.now()}`;
        const templateName = templateData?.name || 'unknown-template';
        const fileName = `${templateName}/${contentId}-${fieldName}.png`;
        
        // Convert base64 to blob
        const base64Data = value.url.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        // Delete old if exists
        await supabase.storage.from('lesson-images').remove([fileName]);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Upload
        const { error: uploadError } = await supabase.storage
          .from('lesson-images')
          .upload(fileName, blob, {
            contentType: 'image/png',
            cacheControl: '0'
          });
        
        if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('lesson-images')
          .getPublicUrl(fileName);
        
        return { ...value, url: `${publicUrl}?t=${Date.now()}` };
      }
      return value;
    };

    // Collect design responses from actual field values
    const designResponses = {};
    for (const field of designerFields) {
      const value = fieldValues[field.id];
      // For checklist fields, ensure array; for others, use value or fallback to placeholder/empty
      if (field.type === 'checklist') {
        designResponses[field.name] = Array.isArray(value) ? value : [];
      } else if (field.type === 'image') {
        // For image fields, upload data URL if needed, then save
        designResponses[field.name] = await uploadDataUrlIfNeeded(value, field.name) || { url: '', altText: '', description: '', imageModel: '', altTextModel: '' };
      } else {
        designResponses[field.name] = value || field.placeholder || '';
      }
    }
    
    // Collect lesson responses from builder field values
    const lessonResponses = {};
    for (const field of builderFields) {
      const value = fieldValues[field.id];
      // For checklist fields, ensure array; for others, use value or fallback to placeholder/empty
      if (field.type === 'checklist') {
        lessonResponses[field.name] = Array.isArray(value) ? value : [];
      } else if (field.type === 'image') {
        // For image fields, upload data URL if needed, then save
        lessonResponses[field.name] = await uploadDataUrlIfNeeded(value, field.name) || { url: '', altText: '', description: '', imageModel: '', altTextModel: '' };
      } else {
        lessonResponses[field.name] = value || field.placeholder || '';
      }
    }

    try {
      let data, error;
      
      if (lessonId) {
        // Update existing test lesson
        const result = await supabase
          .from('lessons')
          .update({
            designer_responses: designResponses,
            builder_responses: lessonResponses,
            template_name: templateData.name
          })
          .eq('id', lessonId)
          .select()
          .single();
        data = result.data;
        error = result.error;
      } else {
        // Create new test lesson
        const result = await supabase
          .from('lessons')
          .insert({
            lesson_template_id: templateData.id,
            template_name: templateData.name,
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
              {templateData?.state && (
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
                  {US_STATES.find(s => s.value === templateData.state)?.label || templateData.state}
                </span>
              )}
              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                color: '#fff',
                margin: 0
              }}>
                {templateData?.name || 'New Lesson'}
              </h1>
            </div>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1.125rem',
              fontWeight: 500,
              marginBottom: 0
            }}>
              Fill in the fields and generate educational content with AI
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
              Save Lesson
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
            <div style={{ minWidth: 0 }}>
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
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'mcqs') {
                            fieldComponent = (
                              <MCQsField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || { questions: ['', '', '', '', ''] }}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onAIGenerate={field.aiEnabled ? () => handleGenerateAI(field) : undefined}
                                onGenerateIndividual={field.aiEnabled ? handleGenerateIndividualMCQ : undefined}
                                onAIConfig={handleAIConfig}
                                isMissing={isMissing}
                              />
                            );
                          } else {
                            fieldComponent = (
                              <BaseField
                                key={field.id}
                                field={field}
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
              <div style={{ minWidth: 0 }}>
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
                                isMissing={isMissing}
                                {...aiProps}
                              />
                            );
                          } else if (field.type === 'mcqs') { console.log('🔥 BUILDER MCQ:', field.name, field.type);
                            fieldComponent = (
                              <MCQsField
                                key={field.id}
                                field={field}
                                value={fieldValues[field.id] || { questions: ['', '', '', '', ''] }}
                                onChange={(value) => setFieldValues(prev => ({ ...prev, [field.id]: value }))}
                                onAIGenerate={field.aiEnabled ? () => handleGenerateAI(field) : undefined}
                                onGenerateIndividual={field.aiEnabled ? handleGenerateIndividualMCQ : undefined}
                                onAIConfig={handleAIConfig}
                                isMissing={isMissing}
                              />
                            );
                          } else {
                            fieldComponent = (
                              <BaseField
                                key={field.id}
                                field={field}
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

      {/* Save Toast Notification */}
      {showSaveToast && (
        <div style={{
          position: 'fixed',
          top: '5rem',
          right: '2rem',
          backgroundColor: '#8b5cf6',
          color: '#fff',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(139, 92, 246, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '1rem',
          fontWeight: 600,
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <Check size={20} />
          Lesson saved successfully!
        </div>
      )}

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
    </div>
  );
}
