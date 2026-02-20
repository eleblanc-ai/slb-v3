/**
 * Utility functions for checking/validating field values.
 * Used by both CreateNewLesson and CreateNewLessonType.
 */

/**
 * Check if a field value is effectively empty.
 * Handles strings (with HTML stripping), arrays, objects, and MCQ structures.
 */
export function isEmptyValue(value) {
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
}

/**
 * Validate that all required context fields for a given AI-enabled field have values.
 * @param {Object} field - The AI-enabled field to check context for
 * @param {Array} allFields - All template fields
 * @param {Object} fieldValues - Current field values keyed by field ID
 * @returns {Array} Array of missing field descriptors: { id, name, section }
 */
export function validateContextFieldsForField(field, allFields, fieldValues) {
  const missing = [];
  const contextFieldIds = field.ai_context_field_ids || [];

  for (const contextFieldId of contextFieldIds) {
    const contextField = allFields.find(f => f.id === contextFieldId);
    if (!contextField) continue;

    const value = fieldValues[contextFieldId];
    if (isEmptyValue(value)) {
      missing.push({
        id: contextField.id,
        name: contextField.name,
        section: contextField.fieldFor === 'designer' ? 'Designer' : 'Builder',
      });
    }
  }

  return missing;
}

/**
 * Check which required fields (field.required === true) are missing values.
 * Used before export/preview to warn about incomplete lessons.
 * @param {Array} fields - All template fields
 * @param {Object} fieldValues - Current field values keyed by field ID
 * @returns {Array} Array of missing field descriptors: { id, name, section }
 */
export function getMissingRequiredFields(fields, fieldValues) {
  const missing = [];
  const requiredFields = fields.filter(f => f.required === true);

  for (const field of requiredFields) {
    const value = fieldValues[field.id];
    const isEmpty =
      !value ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

    if (isEmpty) {
      missing.push({
        id: field.id,
        name: field.name,
        section: field.fieldFor === 'designer' ? 'Designer' : 'Builder',
      });
    }
  }

  return missing;
}
