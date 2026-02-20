/**
 * buildFieldResponses – Build the designer_responses and builder_responses
 * objects that get saved to Supabase `lessons` rows.
 *
 * This logic was duplicated 5+ times across CreateNewLesson and
 * CreateNewLessonType.  The only real difference was how each field is
 * *keyed* in the resulting object:
 *   – CreateNewLesson uses field **ID** as key
 *   – CreateNewLessonType uses field **name** as key
 *
 * @param {Array}  fields       – full field list (has .id, .name, .fieldFor, .type, .placeholder)
 * @param {Object} fieldValues  – current field value map (keyed by field id)
 * @param {Object} [options]
 * @param {'id'|'name'} [options.keyBy='id'] – which field property to use as the response key
 * @returns {{ designerResponses: Object, builderResponses: Object }}
 */
export function buildFieldResponses(fields, fieldValues, { keyBy = 'id' } = {}) {
  const designerResponses = {};
  const builderResponses = {};

  for (const field of fields) {
    const target = field.fieldFor === 'designer' ? designerResponses : builderResponses;
    const key = keyBy === 'name' ? field.name : field.id;
    const value = fieldValues[field.id];

    if (value !== undefined && value !== null) {
      target[key] = value;
    } else {
      target[key] = emptyValueForType(field);
    }
  }

  return { designerResponses, builderResponses };
}

/**
 * Return the appropriate empty/default value for a field based on its type.
 */
function emptyValueForType(field) {
  switch (field.type) {
    case 'checklist':
    case 'assign_standards':
      return [];
    case 'mcqs':
      return { questions: ['', '', '', '', ''] };
    case 'image':
      return { description: '', url: '', altText: '', imageModel: '', altTextModel: '' };
    default:
      return '';
  }
}
