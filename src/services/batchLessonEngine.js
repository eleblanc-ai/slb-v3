/**
 * Batch Lesson Engine — headless lesson creation + AI generation.
 *
 * No React dependencies. All context passed as parameters.
 * Reports progress via callback so any UI can drive it.
 */

import { buildFullPrompt } from '../ai/promptBuilder';
import { buildFieldResponses } from '../ai/responseBuilder';
import {
  callAI,
  callAIWithFunction,
  generateImage,
  generateAltText,
  summarizePassageForImage,
} from './aiClient';
import {
  getMappedStandardsWithSource,
  extractGradesFromBand,
  filterAlignedStandardsWithAI,
  insertStandardInOrder,
  getCcssVocabularyStandardsForGrade,
  getMappedVocabularyStandardsForGrade,
  getCcssMainIdeaStandardsForGrade,
  getMappedMainIdeaStandardsForGrade,
} from '../lib/standardsMapper';
import { applyImportToFields } from '../import/markdownImporter';
import aiPromptDefaults from '../config/aiPromptDefaults.json';
import gradeRangeConfig from '../config/gradeRangeOptions.json';
import themeSelectorConfig from '../config/themeSelectorOptions.json';

/* ─── Retry helper for transient API errors (429 / 529 overloaded) ─── */

async function withRetry(fn, { maxRetries = 3, baseDelay = 5000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err?.message || '';
      const isRetryable = /overloaded|529|rate.?limit|429|too many requests/i.test(msg);
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = baseDelay * Math.pow(2, attempt); // 5s, 10s, 20s
      console.warn(`⏳ Retryable error (attempt ${attempt + 1}/${maxRetries}): ${msg}. Waiting ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/* ─── Field mapping (replicates CreateNewLesson.jsx:1922-1957) ─── */

export function mapDatabaseFields(fieldsData) {
  return fieldsData.map((field) => {
    const mapped = {
      id: field.id,
      type: field.field_type,
      name: field.name,
      placeholder: field.placeholder_text,
      helperText: field.helper_text,
      required: field.required,
      aiEnabled: field.ai_enabled,
      requiredForGeneration: field.required_for_generation,
      importable: field.importable,
      fieldFor: field.field_for || 'designer',
      ai_prompt: field.ai_prompt,
      ai_question_prompts: field.ai_question_prompts,
      ai_context_field_ids: field.ai_context_field_ids,
      ai_system_instructions: field.ai_system_instructions,
      ai_context_instructions: field.ai_context_instructions,
      ai_format_requirements: field.ai_format_requirements,
    };

    if (field.field_type === 'grade_band_selector') {
      mapped.options = gradeRangeConfig.gradeRanges;
    } else if (field.field_type === 'theme_selector') {
      mapped.options = themeSelectorConfig.themes;
    } else if (field.field_config) {
      if (field.field_config.options) mapped.options = field.field_config.options;
      if (field.field_config.min_selections !== undefined)
        mapped.min_selections = field.field_config.min_selections;
      if (field.field_config.max_selections !== undefined)
        mapped.max_selections = field.field_config.max_selections;
      if (field.field_config.framework) mapped.framework = field.field_config.framework;
      if (field.field_config.defaultText) mapped.defaultText = field.field_config.defaultText;
      if (field.field_config.defaultQuestionCount !== undefined) mapped.defaultQuestionCount = field.field_config.defaultQuestionCount;
    }
    return mapped;
  });
}

/* ─── Main entry point ─── */

/**
 * Create a single lesson in Supabase, import markdown values, generate AI content.
 *
 * @param {Object} params
 * @param {Object} params.template        - Row from lesson_templates
 * @param {Array}  params.fields          - Mapped field array (via mapDatabaseFields)
 * @param {Object} params.parsedFields    - { "Field Name": "raw value" } from batchMarkdownParser
 * @param {string} params.userId          - session.user.id
 * @param {string} params.model           - AI model ID (e.g. 'claude-sonnet-4-6')
 * @param {Function} params.onProgress    - (ProgressUpdate) => void
 * @param {Object} params.supabaseClient  - Supabase client instance
 * @returns {Promise<{ lessonId: string|null, fieldValues: Object, errors: string[] }>}
 */
export async function processLesson({
  template,
  fields,
  parsedFields,
  preImportedValues,
  userId,
  model,
  onProgress,
  supabaseClient,
}) {
  const errors = [];
  const progress = (update) => {
    try { onProgress?.(update); } catch (_) { /* ignore callback errors */ }
  };

  /* ── Phase 1: Import markdown values (or use pre-imported from review) ── */
  let fieldValues;

  if (preImportedValues) {
    progress({ phase: 'importing', message: 'Using reviewed import values...' });
    fieldValues = { ...preImportedValues };
  } else {
    progress({ phase: 'importing', message: 'Importing field values...' });

    const { values: importedValues, count, notFoundStandards, missingFields } =
      await applyImportToFields(parsedFields, fields);

    // Start with default text for rich_text fields
    fieldValues = {};
    fields.forEach((f) => {
      if (f.type === 'rich_text' && f.defaultText) {
        fieldValues[f.id] = f.defaultText;
      }
    });
    // Overlay imported values
    Object.assign(fieldValues, importedValues);

    if (missingFields.length > 0) {
      progress({
        phase: 'importing',
        missingFields,
        message: `Imported ${count} fields. Missing: ${missingFields.join(', ')}`,
      });
    }
    if (notFoundStandards.length > 0) {
      errors.push(`Standards not found: ${notFoundStandards.join(', ')}`);
    }
  }

  /* ── Phase 2: Create lesson row in Supabase ── */
  progress({ phase: 'creating', message: 'Creating lesson in database...' });

  const { designerResponses, builderResponses } = buildFieldResponses(fields, fieldValues, {
    keyBy: 'id',
  });

  const { data: newLesson, error: insertError } = await supabaseClient
    .from('lessons')
    .insert({
      lesson_template_id: template.id,
      template_name: template.name,
      created_by: userId,
      designer_responses: designerResponses,
      builder_responses: builderResponses,
      stale_context_map: {},
      context_snapshot_map: {},
      status: 'draft',
      is_test: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create lesson: ${insertError.message}`);
  }

  const lessonId = newLesson.id;
  progress({ phase: 'creating', message: `Lesson created (${lessonId.slice(0, 8)}...)` });

  /* ── Phase 3: Generate AI content for each AI-enabled field ── */
  const aiFields = [
    ...fields.filter((f) => f.fieldFor === 'designer' && f.aiEnabled),
    ...fields.filter((f) => f.fieldFor === 'builder' && f.aiEnabled),
  ];

  let currentFieldValues = { ...fieldValues };

  for (let i = 0; i < aiFields.length; i++) {
    const field = aiFields[i];
    progress({
      phase: 'generating',
      fieldName: field.name,
      fieldIndex: i,
      totalFields: aiFields.length,
      message: `Generating: ${field.name} (${i + 1}/${aiFields.length})`,
    });

    try {
      let generated;

      if (field.type === 'image') {
        generated = await generateImageField({
          field,
          fields,
          fieldValues: currentFieldValues,
          template,
          lessonId,
          supabaseClient,
        });
        progress({
          phase: 'generating',
          fieldName: field.name,
          fieldIndex: i,
          totalFields: aiFields.length,
          imageUrl: generated?.url || null,
          message: `Generated: ${field.name}`,
        });
      } else if (field.type === 'mcqs' || field.type === 'flex_mcq') {
        generated = await generateMCQField({
          field,
          fields,
          fieldValues: currentFieldValues,
          template,
          model,
          supabaseClient,
        });
      } else {
        generated = await generateTextField({
          field,
          fields,
          fieldValues: currentFieldValues,
          model,
          supabaseClient,
        });
      }

      currentFieldValues[field.id] = generated;

      // Save after each field
      const updated = buildFieldResponses(fields, currentFieldValues, { keyBy: 'id' });
      await supabaseClient
        .from('lessons')
        .update({
          designer_responses: updated.designerResponses,
          builder_responses: updated.builderResponses,
        })
        .eq('id', lessonId);
    } catch (err) {
      console.error(`❌ Batch: field "${field.name}" failed:`, err);
      errors.push(`${field.name}: ${err.message}`);
    }
  }

  /* ── Phase 4: Complete ── */
  progress({
    phase: 'complete',
    message: errors.length > 0 ? `Done with ${errors.length} error(s)` : 'Lesson complete!',
  });

  return { lessonId, fieldValues: currentFieldValues, errors };
}

/* ─── Text / rich_text field generation ─── */

async function generateTextField({ field, fields, fieldValues, model, supabaseClient }) {
  const fieldAIConfig = await fetchAIConfig(field.id, supabaseClient);

  const prompt = buildFullPrompt({
    systemInstructions: fieldAIConfig.ai_system_instructions || '',
    prompt: fieldAIConfig.ai_prompt || '',
    formatRequirements: fieldAIConfig.ai_format_requirements || '',
    contextInstructions: fieldAIConfig.ai_context_instructions || '',
    selectedFieldIds: fieldAIConfig.ai_context_field_ids || [],
    allFields: fields,
    fieldValues,
  });

  return await withRetry(() => callAI(prompt, model, 4096));
}

/* ─── Image field generation ─── */

async function generateImageField({
  field,
  fields,
  fieldValues,
  template,
  lessonId,
  supabaseClient,
}) {
  const fieldAIConfig = await fetchAIConfig(field.id, supabaseClient);

  const currentFieldValue = fieldValues[field.id];
  let imagePrompt = '';

  if (currentFieldValue?.description?.trim()) {
    imagePrompt = currentFieldValue.description.trim();
  } else {
    imagePrompt = fieldAIConfig.ai_prompt || 'A high-quality photographic image.';
  }

  // Add context from other fields
  let passageText = '';
  if (fieldAIConfig.ai_context_field_ids?.length > 0) {
    const contextDetails = [];
    fieldAIConfig.ai_context_field_ids.forEach((id) => {
      const contextField = fields.find((f) => f.id === id);
      const val = fieldValues[id];
      if (contextField && val) {
        const displayVal =
          typeof val === 'string' ? val : val.text || val.value || JSON.stringify(val);
        const cleanValFull = displayVal.replace(/<[^>]*>/g, '').trim();
        const cleanVal =
          cleanValFull.length > 500 ? `${cleanValFull.substring(0, 500)}...` : cleanValFull;
        contextDetails.push(`${contextField.name}: ${cleanVal}`);

        if (!passageText && /passage|selection/i.test(contextField.name)) {
          passageText = cleanValFull;
        }
      }
    });
    if (contextDetails.length > 0) {
      imagePrompt += `\n\nSubject matter context:\n${contextDetails.join('\n')}`;
    }
  }

  if (passageText) {
    const summary = await withRetry(() => summarizePassageForImage(passageText, 700));
    if (summary) {
      imagePrompt = `Passage summary for cover image (<=700 chars):\n${summary}\n\n${imagePrompt}`;
    }
  }

  if (
    fieldAIConfig.ai_system_instructions &&
    !fieldAIConfig.ai_system_instructions.includes('clear, concise')
  ) {
    imagePrompt = `${fieldAIConfig.ai_system_instructions}\n\n${imagePrompt}`;
  }

  // Generate image
  const { url: imageDataUrl, model: usedModel, altText: geminiAltText } =
    await withRetry(() => generateImage(imagePrompt, '1024x1024'));

  // Alt text
  let generatedAltText = geminiAltText;
  let altTextModel = usedModel;
  if (!generatedAltText) {
    generatedAltText = await withRetry(() => generateAltText(imageDataUrl));
    altTextModel = 'gpt-4o';
  }

  // Upload to Supabase Storage
  const templateFolder = (template.name || 'unknown-template').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${templateFolder}/${lessonId}.png`;

  const base64Data = imageDataUrl.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });

  // Remove old image first
  await supabaseClient.storage.from('lesson-images').remove([fileName]);
  await new Promise((resolve) => setTimeout(resolve, 100));

  const { error: uploadError } = await supabaseClient.storage
    .from('lesson-images')
    .upload(fileName, blob, { contentType: 'image/png', cacheControl: '0' });

  if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabaseClient.storage.from('lesson-images').getPublicUrl(fileName);

  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

  return {
    url: cacheBustedUrl,
    altText: generatedAltText,
    imageModel: usedModel,
    altTextModel,
    description: currentFieldValue?.description || '',
  };
}

/* ─── MCQ field generation ─── */

async function generateMCQField({ field, fields, fieldValues, template, model, supabaseClient }) {
  const fieldAIConfig = await fetchAIConfig(field.id, supabaseClient, true);

  const defaultQuestionPrompts = aiPromptDefaults.fieldTypePrompts?.mcqs?.questionPrompts || {};
  const questionPromptsConfig = fieldAIConfig.ai_question_prompts || null;

  // Grade + standards setup
  const gradeField = fields.find((f) => f.type === 'grade_band_selector');
  const gradeValue = gradeField ? fieldValues[gradeField.id] : null;
  const gradeLevels = extractGradesFromBand(gradeValue);

  const defaultFramework = template.default_standard_framework || 'CCSS';
  const vocabStandards =
    defaultFramework === 'CCSS'
      ? await getCcssVocabularyStandardsForGrade(gradeLevels)
      : await getMappedVocabularyStandardsForGrade(gradeLevels, defaultFramework);

  const mainIdeaStandards =
    defaultFramework === 'CCSS'
      ? await getCcssMainIdeaStandardsForGrade(gradeLevels)
      : await getMappedMainIdeaStandardsForGrade(gradeLevels, defaultFramework);

  // Context text from configured context fields
  let contextText = '';
  if (fieldAIConfig.ai_context_field_ids?.length > 0) {
    const parts = [];
    for (const ctxId of fieldAIConfig.ai_context_field_ids) {
      const ctxField = fields.find((f) => f.id === ctxId);
      const ctxVal = fieldValues[ctxId];
      if (ctxField && ctxVal) {
        const displayVal =
          typeof ctxVal === 'string' ? ctxVal : ctxVal.text || ctxVal.value || JSON.stringify(ctxVal);
        const clean = displayVal.replace(/<[^>]*>/g, '').trim();
        if (clean) parts.push(`${ctxField.name}:\n${clean}`);
      }
    }
    contextText = parts.join('\n\n');
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
                properties: { A: { type: 'string' }, B: { type: 'string' }, C: { type: 'string' }, D: { type: 'string' } },
                required: ['A', 'B', 'C', 'D'],
              },
              standards: { type: 'array', items: { type: 'string' }, description: 'Relevant standards' },
              correct_answer: { type: 'string', enum: ['A', 'B', 'C', 'D'], description: 'Correct answer letter' },
            },
            required: ['question_text', 'choices', 'standards', 'correct_answer'],
          },
          minItems: 1,
          maxItems: 1,
        },
      },
      required: ['questions'],
    },
  };

  const formattedQuestions = [];
  const sourceStandards = {};
  const filteredOutStandards = {};

  const questionCount = field.type === 'flex_mcq'
    ? (fieldValues[field.id]?.questions?.length || field.defaultQuestionCount || 5)
    : 5;
  for (let i = 0; i < questionCount; i++) {
    const cappedIndex = field.type === 'flex_mcq' ? Math.min(i, 4) : i;
    const questionKey = `q${cappedIndex + 1}`;

    // Get question-specific prompt
    let questionPrompt;
    if (questionPromptsConfig?.[questionKey]) {
      const saved = questionPromptsConfig[questionKey];
      questionPrompt = typeof saved === 'string' ? saved : saved.prompt;
    } else if (defaultQuestionPrompts[questionKey]) {
      const defaultQ = defaultQuestionPrompts[questionKey];
      questionPrompt = typeof defaultQ === 'string' ? defaultQ : defaultQ.prompt;
    } else {
      questionPrompt = 'Generate 1 multiple choice question based on the passage.';
    }

    // Build per-question prompt
    const questionAIConfig = {
      systemInstructions: fieldAIConfig.ai_system_instructions || '',
      prompt: questionPrompt,
      formatRequirements:
        fieldAIConfig.ai_format_requirements || aiPromptDefaults.formatRequirements?.mcqs || '',
      contextInstructions: fieldAIConfig.ai_context_instructions || '',
      selectedFieldIds: fieldAIConfig.ai_context_field_ids || [],
      allFields: fields,
      fieldValues,
    };

    // Per-question standards flags
    const qConfig = questionPromptsConfig?.[questionKey];
    const extraContextBlocks = [];

    if (qConfig?.includeVocabStandards && vocabStandards.length > 0) {
      extraContextBlocks.push({
        title: `Grade-Specific Vocabulary Standards (${defaultFramework})`,
        content: vocabStandards.join('; '),
      });
    }
    if (qConfig?.includeMainIdeaStandards && mainIdeaStandards.length > 0) {
      extraContextBlocks.push({
        title: `Grade-Specific Main Idea Standards (${defaultFramework})`,
        content: mainIdeaStandards.join('; '),
      });
    }
    if (extraContextBlocks.length > 0) {
      questionAIConfig.extraContextBlocks = extraContextBlocks;
    }

    const fullPrompt = buildFullPrompt(questionAIConfig);
    const result = await withRetry(() => callAIWithFunction(fullPrompt, model, functionSchema));

    if (!result?.questions?.[0]) {
      throw new Error(`AI returned invalid response for question ${i + 1}`);
    }

    const q = result.questions[0];
    if (!q.question_text || !q.choices?.A || !q.choices?.B || !q.choices?.C || !q.choices?.D) {
      throw new Error(`Incomplete question ${i + 1}`);
    }

    // Map standards
    let standardsText = q.standards?.join('; ') || '';
    let candidateStandards = [];

    if (q.standards?.length > 0) {
      const mappingResult = await getMappedStandardsWithSource(q.standards[0], gradeLevels);
      standardsText = mappingResult.mappedStandards || standardsText;
      sourceStandards[i] = mappingResult.sourceStandard;

      candidateStandards = standardsText
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && s !== mappingResult.sourceStandard?.code);
    }

    // Filter aligned standards with AI
    let filteredOutForQuestion = [];
    if (contextText && candidateStandards.length > 0) {
      const questionText = `${q.question_text}\nA. ${q.choices.A}\nB. ${q.choices.B}\nC. ${q.choices.C}\nD. ${q.choices.D}`;
      const filteredStandards = await withRetry(() => filterAlignedStandardsWithAI(
        questionText,
        contextText,
        candidateStandards,
        callAI,
        model
      ));
      filteredOutForQuestion = candidateStandards.filter((s) => !filteredStandards.includes(s));
      standardsText = filteredStandards.join('; ');
    }

    if (sourceStandards[i]?.code) {
      standardsText = insertStandardInOrder(standardsText, sourceStandards[i].code);
    }

    const formattedMCQ = `<p>${i + 1}. ${q.question_text}<br>A. ${q.choices.A}<br>B. ${q.choices.B}<br>C. ${q.choices.C}<br>D. ${q.choices.D}<br>[${standardsText}]<br>KEY: ${q.correct_answer}</p>`;
    formattedQuestions.push(formattedMCQ);

    if (filteredOutForQuestion.length > 0) {
      filteredOutStandards[i] = filteredOutForQuestion;
    }
  }

  return { questions: formattedQuestions, sourceStandards, filteredOutStandards };
}

/* ─── Helpers ─── */

async function fetchAIConfig(fieldId, supabaseClient, includeQuestionPrompts = false) {
  const selectCols = [
    'ai_prompt',
    'ai_context_field_ids',
    'ai_system_instructions',
    'ai_context_instructions',
    'ai_format_requirements',
  ];
  if (includeQuestionPrompts) selectCols.push('ai_question_prompts');

  const { data, error } = await supabaseClient
    .from('lesson_template_fields')
    .select(selectCols.join(', '))
    .eq('id', fieldId)
    .single();

  if (error) throw new Error(`Failed to load AI config for field ${fieldId}`);
  return data;
}
