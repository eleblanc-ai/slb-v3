const htmlTagPattern = /<\/?[a-z][\s\S]*>/i;

/**
 * Convert potentially HTML-formatted content to plain text,
 * preserving any literal HTML tag references that appear as text content.
 * TipTap entity-encodes user-typed tag names (&lt;p&gt;), so we strip
 * actual HTML structure tags first, then decode entities to reveal the
 * literal tag names the user intended.
 */
function htmlToPlainText(value) {
  if (!value || typeof value !== 'string') return value || '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // If no HTML-like content detected, return as-is (plain text)
  if (!htmlTagPattern.test(trimmed)) {
    return trimmed;
  }

  // Check if this is structured HTML from TipTap (starts with a block element)
  const isStructuredHtml = /^<(?:p|h[1-6]|ul|ol|div|blockquote|table)\b/i.test(trimmed);

  if (!isStructuredHtml) {
    // Plain text that happens to mention HTML tags — return as-is
    return trimmed;
  }

  // 1. Strip actual HTML structure tags first.
  //    Entity-encoded tags like &lt;p&gt; do NOT match /<[^>]*>/
  //    so they are preserved through this step.
  let text = trimmed
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  // 2. Now decode HTML entities to reveal literal tag names.
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
}

/**
 * Build a complete prompt that matches the ConfigureAIModal preview format
 * @param {Object} config - Configuration object
 * @param {string} config.systemInstructions - System instructions
 * @param {string} config.prompt - Field-specific prompt/task
 * @param {string} config.formatRequirements - Format requirements
 * @param {string} config.contextInstructions - Instructions for using context
 * @param {string[]} config.selectedFieldIds - IDs of context fields
 * @param {Array} config.allFields - Array of all available fields
 * @param {Object} config.fieldValues - Object with field values
 * @param {Array} config.extraContextBlocks - Additional context blocks to append
 * @returns {string} - The complete prompt to send to AI
 */
export function buildFullPrompt(config) {
  const {
    systemInstructions = '',
    prompt = '',
    formatRequirements = '',
    contextInstructions = '',
    selectedFieldIds = [],
    allFields = [],
    fieldValues = {},
    extraContextBlocks = []
  } = config;

  let fullPrompt = '';
  const normalizedSystemInstructions = htmlToPlainText(systemInstructions);
  const normalizedPrompt = htmlToPlainText(prompt);
  const normalizedFormatRequirements = htmlToPlainText(formatRequirements);
  const normalizedContextInstructions = htmlToPlainText(contextInstructions);

  // Add system instructions
  if (normalizedSystemInstructions) {
    fullPrompt += '=== SYSTEM INSTRUCTIONS ===\n';
    fullPrompt += normalizedSystemInstructions + '\n\n';
  }

  // Add task/prompt
  if (normalizedPrompt) {
    fullPrompt += '=== TASK ===\n';
    fullPrompt += normalizedPrompt + '\n\n';
  }

  // ALWAYS add format requirements
  fullPrompt += '=== FORMAT REQUIREMENTS ===\n';
  fullPrompt += (normalizedFormatRequirements || 'No specific format requirements.') + '\n\n';

  // Add context if any fields are selected or extra context blocks are provided
  if (selectedFieldIds.length > 0 || extraContextBlocks.length > 0) {
    fullPrompt += '=== CONTEXT ===\n';
    // ALWAYS add context instructions
    fullPrompt += (normalizedContextInstructions || 'Use the following context information to complete the task.') + '\n\n';

    selectedFieldIds.forEach(fieldId => {
      const contextField = allFields.find(f => f.id === fieldId);
      if (contextField) {
        const fieldValue = fieldValues[fieldId];
        let displayValue = '[Not filled]';

        if (fieldValue) {
          if (typeof fieldValue === 'string') {
            displayValue = fieldValue;
          } else if (typeof fieldValue === 'object') {
            // For MCQ fields, remove metadata (sourceStandards, filteredOutStandards, standards)
            // These are internal tracking data not needed for AI context
            if (fieldValue.questions && Array.isArray(fieldValue.questions)) {
              const cleanedValue = { questions: fieldValue.questions };
              displayValue = JSON.stringify(cleanedValue, null, 2);
            } else {
              displayValue = JSON.stringify(fieldValue, null, 2);
            }
          }
        }

        fullPrompt += `${contextField.name}: ${displayValue}\n`;
      }
    });

    if (extraContextBlocks.length > 0) {
      extraContextBlocks.forEach(block => {
        if (!block || !block.title || !block.content) return;
        fullPrompt += `\n${block.title}:\n${block.content}\n`;
      });
    }
  }

  console.log('📋 Built prompt:\n', fullPrompt);
  return fullPrompt;
}
