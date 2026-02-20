import { arrayMove } from '@dnd-kit/sortable';
import { supabase } from '../services/supabaseClient';

/**
 * Handle drag-end for reordering fields within a section (designer or builder).
 * Reorders local state and persists the new order to Supabase.
 *
 * @param {object}   event       – DnD event from @dnd-kit
 * @param {string}   fieldType   – 'designer' | 'builder'
 * @param {Array}    fields      – full fields array
 * @param {Function} setFields   – state setter for fields
 */
export async function handleFieldDragEnd(event, fieldType, fields, setFields) {
  const { active, over } = event;

  if (!over || active.id === over.id) return;

  const filteredFields = fields.filter((f) => f.fieldFor === fieldType);
  const oldIndex = filteredFields.findIndex((f) => f.id === active.id);
  const newIndex = filteredFields.findIndex((f) => f.id === over.id);

  if (oldIndex === -1 || newIndex === -1) return;

  // Reorder in local state
  const reorderedFiltered = arrayMove(filteredFields, oldIndex, newIndex);

  // Merge back with other field type
  const otherFields = fields.filter((f) => f.fieldFor !== fieldType);
  const newFields = [...otherFields, ...reorderedFiltered];
  setFields(newFields);

  // Update order in database
  try {
    const updates = reorderedFiltered.map((field, index) => ({
      id: field.id,
      field_order: index,
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
}
