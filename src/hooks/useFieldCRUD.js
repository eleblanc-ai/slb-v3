import { useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { handleFieldDragEnd } from '../lib/dragUtils';
import { supabase } from '../services/supabaseClient';

/**
 * useFieldCRUD — shared hook for field add/edit/delete/drag operations.
 *
 * Works identically for both CreateNewLesson (lesson editing) and
 * CreateNewLessonType (template design).  The only difference is that
 * template design also persists `field_config` (options, framework,
 * min/max selections).  Pass `includeFieldConfig: true` to enable that.
 */
export default function useFieldCRUD({
  templateId,
  fields,
  setFields,
  session,
  toast,
  includeFieldConfig = false,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);

  /* ── DnD sensors (identical in both pages) ── */
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event, fieldType) =>
    handleFieldDragEnd(event, fieldType, fields, setFields);

  /* ── Build field_config object (only used in template mode) ── */
  const buildFieldConfig = (fieldData) => {
    if (!includeFieldConfig) return undefined;
    const cfg = {};
    if (fieldData.options) cfg.options = fieldData.options;
    if (fieldData.min_selections !== undefined) cfg.min_selections = fieldData.min_selections;
    if (fieldData.max_selections !== undefined) cfg.max_selections = fieldData.max_selections;
    if (fieldData.framework) cfg.framework = fieldData.framework;
    return Object.keys(cfg).length > 0 ? cfg : null;
  };

  /* ── Add or edit a field ── */
  const handleFieldAdded = async (fieldData, isEdit) => {
    if (!templateId) return;

    try {
      if (isEdit) {
        const updateData = {
          field_type: fieldData.type,
          name: fieldData.name,
          placeholder_text: fieldData.placeholder,
          helper_text: fieldData.helperText,
          required: fieldData.required,
          ai_enabled: fieldData.aiEnabled,
          required_for_generation: fieldData.requiredForGeneration,
          field_for: fieldData.fieldFor,
        };

        const fieldConfig = buildFieldConfig(fieldData);
        if (fieldConfig !== undefined) updateData.field_config = fieldConfig;

        const { error } = await supabase
          .from('lesson_template_fields')
          .update(updateData)
          .eq('id', fieldData.id);

        if (error) throw error;
        setFields(fields.map((f) => (f.id === fieldData.id ? fieldData : f)));
      } else {
        const insertData = {
          lesson_template_id: templateId,
          field_type: fieldData.type,
          name: fieldData.name,
          placeholder_text: fieldData.placeholder,
          helper_text: fieldData.helperText,
          required: fieldData.required,
          ai_enabled: fieldData.aiEnabled,
          required_for_generation: fieldData.requiredForGeneration,
          field_for: fieldData.fieldFor,
          field_order: fields.length,
        };

        const fieldConfig = buildFieldConfig(fieldData);
        if (fieldConfig !== undefined) insertData.field_config = fieldConfig;

        const { data: newField, error } = await supabase
          .from('lesson_template_fields')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        setFields([...fields, { ...fieldData, id: newField.id }]);
      }

      // Update the lesson template's updated_at timestamp
      const { error: updateError } = await supabase
        .from('lesson_templates')
        .update({
          updated_at: new Date().toISOString(),
          updated_by: session?.user?.id,
        })
        .eq('id', templateId);

      if (updateError) {
        console.error('Error updating lesson template timestamp:', updateError);
      }
    } catch (error) {
      console.error('Error saving field:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      toast.error(`Failed to save field: ${error.message || 'Please try again.'}`);
    }

    setEditingField(null);
  };

  /* ── Delete a field ── */
  const handleDeleteField = async (fieldId) => {
    if (!templateId) return;

    try {
      const { error } = await supabase
        .from('lesson_template_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;
      setFields(fields.filter((f) => f.id !== fieldId));

      // Update the lesson template's updated_at timestamp
      const { error: updateError } = await supabase
        .from('lesson_templates')
        .update({
          updated_at: new Date().toISOString(),
          updated_by: session?.user?.id,
        })
        .eq('id', templateId);

      if (updateError) {
        console.error('Error updating lesson template timestamp:', updateError);
      }
    } catch (error) {
      console.error('Error deleting field:', error);
      toast.error('Failed to delete field. Please try again.');
    }
  };

  /* ── Open / close modal helpers ── */
  const handleEditField = (field) => {
    setEditingField(field);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingField(null);
  };

  const openAddFieldModal = () => {
    setEditingField(null);
    setIsModalOpen(true);
  };

  return {
    isModalOpen,
    editingField,
    sensors,
    handleFieldAdded,
    handleEditField,
    handleDeleteField,
    handleModalClose,
    handleDragEnd,
    openAddFieldModal,
  };
}
