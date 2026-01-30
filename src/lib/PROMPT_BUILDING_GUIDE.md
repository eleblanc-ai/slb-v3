# Prompt Building Guide

## Rule: All AI prompts must follow this exact structure

Whenever building a prompt for AI generation, use this exact format and order. This applies to:
- ConfigureAIModal preview display
- AI generation in handleGenerateAI
- Any other place where prompts are constructed

### Prompt Structure (in order)

```
=== SYSTEM INSTRUCTIONS ===
[systemInstructions text]

=== TASK ===
[prompt/task text]

=== FORMAT REQUIREMENTS ===
[formatRequirements text]

=== CONTEXT ===
[contextInstructions text]

[Field Name 1]: [Field Value 1]
[Field Name 2]: [Field Value 2]
```

### Key Rules

1. **Section Headers**: Always use `=== SECTION_NAME ===` format with blank lines before and after each section
2. **Field Values from localStorage**: Context field values MUST come from `localStorage.getItem('fieldValues')`
3. **No Conditional Headers**: The `=== CONTEXT ===` header appears ONLY when there are selected context fields
4. **Field Value Display**: 
   - If field has a value: display the actual value
   - If field is empty: display `[Not filled]`
5. **Order**: System Instructions → Task → Format Requirements → Context (always last if present)

### Reference Implementation

See `buildFullPrompt()` in `/src/lib/promptBuilder.js` for the canonical implementation.

### Where to Use

1. **ConfigureAIModal.jsx** - Preview display must call `buildFullPrompt()` with localStorage fieldValues
2. **CreateNewLessonType.jsx** - `handleGenerateAI()` must call `buildFullPrompt()` with localStorage fieldValues
3. **Any new AI features** - Always use `buildFullPrompt()` utility function

### Field Values Storage

- **Storage Method**: `localStorage.setItem('fieldValues', JSON.stringify(fieldValues))`
- **Sync Pattern**: UseEffect in CreateNewLessonType that saves fieldValues whenever state changes
- **Retrieval**: `JSON.parse(localStorage.getItem('fieldValues') || '{}')`

### Example

```javascript
const prompt = buildFullPrompt({
  systemInstructions: 'You are an AI assistant helping to create educational content.',
  prompt: 'Generate an argumentative writing prompt based on the lesson.',
  formatRequirements: 'Return plain text without markdown formatting.',
  contextInstructions: 'Use the following context from other fields to inform your generation:',
  selectedFieldIds: ['passage-id', 'grade-id'],
  allFields: fields,
  fieldValues: JSON.parse(localStorage.getItem('fieldValues') || '{}')
});
```

This ensures the prompt sent to AI matches exactly what's displayed in the preview.
