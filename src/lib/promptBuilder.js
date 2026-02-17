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

  // Add system instructions
  if (systemInstructions) {
    fullPrompt += '=== SYSTEM INSTRUCTIONS ===\n';
    fullPrompt += systemInstructions + '\n\n';
  }

  // Add task/prompt
  if (prompt) {
    fullPrompt += '=== TASK ===\n';
    fullPrompt += prompt + '\n\n';
  }

  // ALWAYS add format requirements
  fullPrompt += '=== FORMAT REQUIREMENTS ===\n';
  fullPrompt += (formatRequirements || 'No specific format requirements.') + '\n\n';

  // Add context if any fields are selected or extra context blocks are provided
  if (selectedFieldIds.length > 0 || extraContextBlocks.length > 0) {
    fullPrompt += '=== CONTEXT ===\n';
    // ALWAYS add context instructions
    fullPrompt += (contextInstructions || 'Use the following context information to complete the task.') + '\n\n';

    selectedFieldIds.forEach(fieldId => {
      const contextField = allFields.find(f => f.id === fieldId);
      if (contextField) {
        const fieldValue = fieldValues[fieldId];
        let displayValue = '[Not filled]';

        if (fieldValue) {
          if (typeof fieldValue === 'string') {
            displayValue = fieldValue;
          } else if (typeof fieldValue === 'object') {
            displayValue = JSON.stringify(fieldValue, null, 2);
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
