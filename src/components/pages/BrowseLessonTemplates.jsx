import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { US_STATES } from '../../config/usStates';
import { FileText, ArrowLeft, X, Copy } from 'lucide-react';

export default function BrowseLessonTemplates() {
  const navigate = useNavigate();
  const { session, profile } = useOutletContext() || {};
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'edit';
  const [lessonTypes, setLessonTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [deletedTemplateName, setDeletedTemplateName] = useState(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [templateToClone, setTemplateToClone] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneState, setCloneState] = useState('');
  const [cloning, setCloning] = useState(false);
  const [showCloneSuccessModal, setShowCloneSuccessModal] = useState(false);
  const [clonedTemplateName, setClonedTemplateName] = useState(null);
  const [clonedTemplateState, setClonedTemplateState] = useState(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchLessonTypes();
    }
  }, [session?.user?.id]);

  const fetchLessonTypes = async () => {
    try {
      // Fetch ALL lesson templates (not just user's own)
      const { data: templates, error } = await supabase
        .from('lesson_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching lesson templates:', error);
        console.error('Error details:', error);
        return;
      }

      // Fetch profiles for all unique user IDs
      const userIds = new Set();
      templates?.forEach(t => {
        if (t.created_by) userIds.add(t.created_by);
        if (t.updated_by) userIds.add(t.updated_by);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', Array.from(userIds));

      // Create a map of user IDs to display names
      const profileMap = {};
      profiles?.forEach(p => {
        profileMap[p.id] = p.display_name;
      });

      // Add profile info to templates
      const templatesWithProfiles = templates?.map(t => ({
        ...t,
        created_by_profile: { display_name: profileMap[t.created_by] },
        updated_by_profile: { display_name: profileMap[t.updated_by] }
      }));

      console.log('Fetched lesson templates:', templatesWithProfiles);
      setLessonTypes(templatesWithProfiles || []);
    } catch (error) {
      console.error('Error in fetchLessonTypes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLessonType = (lessonType) => {
    navigate(`/create-new-lesson-type?id=${lessonType.id}`);
  };

  const handleDeleteClick = (e, lessonType) => {
    e.stopPropagation(); // Prevent card click
    setTemplateToDelete(lessonType);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    
    setDeleting(true);
    try {
      // Delete the lesson template (this will cascade to related tables due to foreign key constraints)
      const { error } = await supabase
        .from('lesson_templates')
        .delete()
        .eq('id', templateToDelete.id);
      
      if (error) throw error;
      
      // Remove from local state
      setLessonTypes(prev => prev.filter(t => t.id !== templateToDelete.id));
      
      // Show cleanup reminder modal
      setDeletedTemplateName(templateToDelete.name);
      setShowCleanupModal(true);
      
      // Close delete modal
      setShowDeleteModal(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Error deleting lesson template:', error);
      alert('Failed to delete lesson template. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setTemplateToDelete(null);
  };

  const handleCloneClick = (e, lessonType) => {
    e.stopPropagation(); // Prevent card click
    setTemplateToClone(lessonType);
    
    // Remove any existing state suffix from the name (e.g., "(Copy)", "(Florida)", etc.)
    const baseName = lessonType.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    
    // If template has a state, suggest "(State)" format, otherwise use "(Copy)"
    const stateName = lessonType.state 
      ? US_STATES.find(s => s.value === lessonType.state)?.label 
      : null;
    const suggestedName = stateName 
      ? `${baseName} (${stateName})`
      : `${baseName} (Copy)`;
    
    setCloneName(suggestedName);
    setCloneState(lessonType.state || '');
    setShowCloneModal(true);
  };

  const handleCloneCancel = () => {
    setShowCloneModal(false);
    setTemplateToClone(null);
    setCloneName('');
    setCloneState('');
  };

  const handleCloneConfirm = async () => {
    if (!templateToClone || !cloneName.trim()) {
      alert('Please enter a name for the cloned template.');
      return;
    }
    
    setCloning(true);
    try {
      // 1. Create new template
      const { data: newTemplate, error: templateError } = await supabase
        .from('lesson_templates')
        .insert({
          name: cloneName.trim(),
          category: templateToClone.category,
          state: cloneState || null,
          created_by: session.user.id,
          updated_by: session.user.id
        })
        .select()
        .single();
      
      if (templateError) throw templateError;

      // 2. Fetch all fields from the original template
      const { data: originalFields, error: fieldsError } = await supabase
        .from('lesson_template_fields')
        .select('*')
        .eq('lesson_template_id', templateToClone.id)
        .order('field_order', { ascending: true });
      
      if (fieldsError) throw fieldsError;

      // 3. Clone all fields to new template
      if (originalFields && originalFields.length > 0) {
        console.log('🔄 Cloning fields. Original field IDs:', originalFields.map(f => ({ id: f.id, name: f.name, order: f.field_order })));
        
        // First insert without context field IDs to get new IDs
        const fieldsToInsert = originalFields.map(field => ({
          lesson_template_id: newTemplate.id,
          field_type: field.field_type,
          name: field.name,
          placeholder_text: field.placeholder_text,
          helper_text: field.helper_text,
          required: field.required,
          ai_enabled: field.ai_enabled,
          required_for_generation: field.required_for_generation,
          field_for: field.field_for,
          field_order: field.field_order,
          ai_prompt: field.ai_prompt,
          ai_question_prompts: field.ai_question_prompts,
          ai_system_instructions: field.ai_system_instructions,
          ai_context_instructions: field.ai_context_instructions,
          ai_format_requirements: field.ai_format_requirements,
          field_config: field.field_config
        }));

        const { data: newFields, error: insertFieldsError } = await supabase
          .from('lesson_template_fields')
          .insert(fieldsToInsert)
          .select()
          .order('field_order', { ascending: true });
        
        if (insertFieldsError) throw insertFieldsError;

        console.log('✨ New field IDs:', newFields.map(f => ({ id: f.id, name: f.name, order: f.field_order })));

        // Create mapping of old field IDs to new field IDs based on matching field_order and name
        const fieldIdMap = {};
        originalFields.forEach((oldField) => {
          const matchingNewField = newFields.find(
            nf => nf.field_order === oldField.field_order && nf.name === oldField.name
          );
          if (matchingNewField) {
            fieldIdMap[oldField.id] = matchingNewField.id;
          }
        });

        console.log('🗺️ Field ID mapping:', fieldIdMap);

        // Update context field IDs references
        const fieldsToUpdate = [];
        newFields.forEach((newField) => {
          const oldField = originalFields.find(
            of => of.field_order === newField.field_order && of.name === newField.name
          );
          
          if (oldField?.ai_context_field_ids && oldField.ai_context_field_ids.length > 0) {
            const newContextFieldIds = oldField.ai_context_field_ids
              .map(oldId => fieldIdMap[oldId])
              .filter(Boolean); // Remove any unmapped IDs
            
            console.log(`📎 Field "${newField.name}": old context IDs [${oldField.ai_context_field_ids}] -> new context IDs [${newContextFieldIds}]`);
            
            if (newContextFieldIds.length > 0) {
              fieldsToUpdate.push({
                id: newField.id,
                ai_context_field_ids: newContextFieldIds
              });
            }
          }
        });

        // Batch update context field IDs
        if (fieldsToUpdate.length > 0) {
          console.log('💾 Updating context field IDs for', fieldsToUpdate.length, 'fields');
          for (const update of fieldsToUpdate) {
            const { error: updateError } = await supabase
              .from('lesson_template_fields')
              .update({ ai_context_field_ids: update.ai_context_field_ids })
              .eq('id', update.id);
            
            if (updateError) {
              console.error('Error updating context field IDs:', updateError);
            }
          }
          console.log('✅ Context field IDs updated successfully');
        }
      }

      // 4. Add new template to local state
      const newTemplateWithProfile = {
        ...newTemplate,
        created_by_profile: { display_name: profile?.display_name },
        updated_by_profile: { display_name: profile?.display_name }
      };
      setLessonTypes([newTemplateWithProfile, ...lessonTypes]);
      
      // Close clone modal and show setup instructions
      handleCloneCancel();
      setClonedTemplateName(cloneName);
      setClonedTemplateState(cloneState);
      setShowCloneSuccessModal(true);
    } catch (error) {
      console.error('Error cloning lesson template:', error);
      alert('Failed to clone lesson template. Please try again.');
    } finally {
      setCloning(false);
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
        <p style={{ color: 'var(--gray-600)' }}>Loading your lesson templates...</p>
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
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header Section */}
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
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
              color: '#fff'
            }}>
              Browse Lesson Templates
            </h1>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1.125rem',
              fontWeight: 500
            }}>
              Continue working on your lesson templates
            </p>
          </div>
        </div>

        {/* Content Card */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem',
          minHeight: '500px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Lesson Templates Grid */}
          {lessonTypes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              color: 'var(--gray-500)'
            }}>
              <FileText size={64} style={{ color: 'var(--gray-300)', margin: '0 auto 1rem' }} />
              <p style={{
                fontSize: '1.125rem',
                marginBottom: '0.5rem',
                fontWeight: 600
              }}>
                No lesson templates yet
              </p>
              <p style={{ fontSize: '0.875rem' }}>
                Create your first lesson template from the home page
              </p>
            </div>
          ) : (
            <>
              {/* Core Templates Section */}
              {lessonTypes.filter(t => !t.state).length > 0 && (
                <div style={{ marginBottom: '3rem' }}>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--gray-900)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981'
                    }}></span>
                    Core Templates
                  </h2>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: '1.5rem'
                  }}>
                    {lessonTypes.filter(t => !t.state).map((lessonType) => {
                      return (
                        <div
                          key={lessonType.id}
                          style={{
                            position: 'relative',
                            backgroundColor: '#fff',
                            borderRadius: '12px',
                            border: '2px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            minWidth: 0,
                            overflow: 'hidden'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                          }}
                        >
                          {/* Action Buttons - Top Right */}
                          <div style={{
                            position: 'absolute',
                            top: '0.75rem',
                            right: '0.75rem',
                            display: 'flex',
                            gap: '0.5rem',
                            zIndex: 10
                          }}>
                            {mode !== 'create' && (
                              <>
                                {/* Clone Button */}
                                <button
                                  onClick={(e) => handleCloneClick(e, lessonType)}
                                  title="Clone Template"
                                  style={{
                                    background: 'rgba(156, 163, 175, 0.1)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.375rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#6b7280',
                                    transition: 'all 0.2s',
                                    opacity: 0.7
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                                    e.currentTarget.style.color = '#3b82f6';
                                    e.currentTarget.style.opacity = '1';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
                                    e.currentTarget.style.color = '#6b7280';
                                    e.currentTarget.style.opacity = '0.7';
                                  }}
                                >
                                  <Copy size={14} />
                                </button>
                              </>
                            )}

                            {mode !== 'create' && (
                              <>
                                {/* Delete Button */}
                                <button
                                  onClick={(e) => handleDeleteClick(e, lessonType)}
                                  title="Delete Template"
                                  style={{
                                    background: 'rgba(156, 163, 175, 0.1)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.375rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#6b7280',
                                    transition: 'all 0.2s',
                                    opacity: 0.7
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                    e.currentTarget.style.color = '#dc2626';
                                    e.currentTarget.style.opacity = '1';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
                                    e.currentTarget.style.color = '#6b7280';
                                    e.currentTarget.style.opacity = '0.7';
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              </>
                            )}
                          </div>
                          
                          {/* Main content area - clickable */}
                          <div
                            style={{
                              padding: '1.5rem',
                              textAlign: 'left',
                              width: '100%',
                              maxWidth: '100%',
                              overflow: 'hidden'
                            }}
                          >
                          {/* Title */}
                          <h3 style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: 'var(--gray-900)',
                            margin: '0 0 0.5rem 0',
                            lineHeight: '1.3',
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            whiteSpace: 'normal',
                            maxWidth: '100%',
                            paddingRight: '2rem'
                          }}>
                            {lessonType.name}
                          </h3>

                          {/* Category badge */}
                          <div style={{ marginBottom: '1rem' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.75rem',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              color: '#059669',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {lessonType.category}
                            </span>
                          </div>

                          {/* Footer */}
                          <div style={{
                            paddingTop: '1rem',
                            borderTop: '1px solid var(--gray-200)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}>
                            {/* Metadata */}
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'var(--gray-500)'
                            }}>
                              <div>
                                Updated {new Date(lessonType.updated_at).toLocaleString()}
                              </div>
                              <div style={{ marginTop: '0.25rem' }}>
                                by {lessonType.updated_by_profile?.display_name || lessonType.created_by_profile?.display_name || 'Unknown'}
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <button
                              onClick={() => mode === 'create' ? navigate(`/create-new-lesson?templateId=${lessonType.id}`) : handleSelectLessonType(lessonType)}
                              style={{
                                width: '100%',
                                padding: '0.5rem 1rem',
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.3)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              {mode === 'create' ? 'Create Lesson' : 'Edit Template'}
                            </button>
                          </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* State-Specific Templates - Organized by State */}
              {lessonTypes.filter(t => t.state).length > 0 && (
                <>
                  {[...new Set(lessonTypes.filter(t => t.state).map(t => t.state))].sort().map(state => {
                    const stateTemplates = lessonTypes.filter(t => t.state === state);
                    const stateLabel = US_STATES.find(s => s.value === state)?.label || state;
                    
                    return (
                      <div key={state} style={{ marginBottom: '3rem' }}>
                        <h2 style={{
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: 'var(--gray-900)',
                          marginBottom: '1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#1e40af'
                          }}></span>
                          {stateLabel} Templates
                        </h2>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                          gap: '1.5rem'
                        }}>
                          {stateTemplates.map((lessonType) => {
              const stateName = lessonType.state 
                ? US_STATES.find(s => s.value === lessonType.state)?.label 
                : null;

              return (
                <div
                  key={lessonType.id}
                  style={{
                    position: 'relative',
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    border: '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  {/* Action Buttons - Top Right */}
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    display: 'flex',
                    gap: '0.5rem',
                    zIndex: 10
                  }}>
                    {mode !== 'create' && (
                      <>
                        {/* Clone Button */}
                        <button
                          onClick={(e) => handleCloneClick(e, lessonType)}
                          title="Clone Template"
                          style={{
                            background: 'rgba(156, 163, 175, 0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.375rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6b7280',
                            transition: 'all 0.2s',
                            opacity: 0.7
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                            e.currentTarget.style.color = '#3b82f6';
                            e.currentTarget.style.opacity = '1';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
                            e.currentTarget.style.color = '#6b7280';
                            e.currentTarget.style.opacity = '0.7';
                          }}
                        >
                          <Copy size={14} />
                        </button>
                      </>
                    )}

                    {mode !== 'create' && (
                      <>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDeleteClick(e, lessonType)}
                          title="Delete Template"
                          style={{
                            background: 'rgba(156, 163, 175, 0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.375rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6b7280',
                            transition: 'all 0.2s',
                            opacity: 0.7
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.color = '#dc2626';
                            e.currentTarget.style.opacity = '1';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
                            e.currentTarget.style.color = '#6b7280';
                            e.currentTarget.style.opacity = '0.7';
                          }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Main content area - clickable */}
                  <div
                    style={{
                      padding: '1.5rem',
                      textAlign: 'left',
                      width: '100%',
                      maxWidth: '100%',
                      overflow: 'hidden'
                    }}
                  >
                  {/* Title */}
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'var(--gray-900)',
                    margin: '0 0 0.5rem 0',
                    lineHeight: '1.3',
                    wordBreak: 'break-all',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'normal',
                    maxWidth: '100%',
                    paddingRight: '2rem'
                  }}>
                    {lessonType.name}
                  </h3>

                  {/* State badge or Category badge */}
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: 'rgba(102, 126, 234, 0.1)',
                      color: 'var(--primary)',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {stateName || lessonType.category}
                    </span>
                  </div>

                  {/* Footer */}
                  <div style={{
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--gray-200)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    {/* Metadata */}
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--gray-500)'
                    }}>
                      <div>
                        Updated {new Date(lessonType.updated_at).toLocaleString()}
                      </div>
                      <div style={{ marginTop: '0.25rem' }}>
                        by {lessonType.updated_by_profile?.display_name || lessonType.created_by_profile?.display_name || 'Unknown'}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <button
                      onClick={() => mode === 'create' ? navigate(`/create-new-lesson?templateId=${lessonType.id}`) : handleSelectLessonType(lessonType)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 1rem',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.3)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {mode === 'create' ? 'Create Lesson' : 'Edit Template'}
                    </button>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
        )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--gray-900)',
            marginBottom: '1rem'
          }}>
            Delete Lesson Template?
          </h3>
          
          <p style={{
            color: 'var(--gray-600)',
            marginBottom: '1.5rem',
            lineHeight: '1.5'
          }}>
            Are you sure you want to delete "<strong>{templateToDelete?.name}</strong>"? 
            This will permanently delete the template and all related lessons. This action cannot be undone.
          </p>
          
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleDeleteCancel}
              disabled={deleting}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                background: '#fff',
                color: 'var(--gray-700)',
                cursor: deleting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                opacity: deleting ? 0.6 : 1
              }}
            >
              No, Keep Template
            </button>
            
            <button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                background: deleting ? 'var(--gray-400)' : '#dc2626',
                color: '#fff',
                cursor: deleting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Clone Template Modal */}
      {showCloneModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--gray-900)',
            marginBottom: '1rem'
          }}>
            Clone Lesson Template
          </h3>
          
          <p style={{
            color: 'var(--gray-600)',
            marginBottom: '1.5rem',
            lineHeight: '1.5'
          }}>
            Create a copy of "<strong>{templateToClone?.name}</strong>" with all its fields and configuration.
          </p>

          {/* Template Name Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--gray-700)',
              marginBottom: '0.5rem'
            }}>
              New Template Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Enter name for cloned template"
              disabled={cloning}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: 'var(--gray-900)',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--gray-300)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* State Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--gray-700)',
              marginBottom: '0.5rem'
            }}>
              Associated State (Optional)
            </label>
            <select
              value={cloneState}
              onChange={(e) => {
                const newState = e.target.value;
                setCloneState(newState);
                
                // Auto-update the template name to include the new state
                if (templateToClone) {
                  const baseName = templateToClone.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
                  const stateName = newState ? US_STATES.find(s => s.value === newState)?.label : null;
                  const newName = stateName ? `${baseName} (${stateName})` : `${baseName} (Copy)`;
                  setCloneName(newName);
                }
              }}
              disabled={cloning}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: 'var(--gray-900)',
                outline: 'none',
                transition: 'all 0.2s',
                backgroundColor: '#fff',
                cursor: cloning ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--gray-300)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="">No State Association</option>
              {US_STATES.map(state => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--gray-500)',
              marginTop: '0.375rem'
            }}>
              Optional: Associate this template with a specific state
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleCloneCancel}
              disabled={cloning}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid var(--gray-300)',
                borderRadius: '6px',
                background: '#fff',
                color: 'var(--gray-700)',
                cursor: cloning ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                opacity: cloning ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            
            <button
              onClick={handleCloneConfirm}
              disabled={cloning || !cloneName.trim()}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '6px',
                background: (cloning || !cloneName.trim()) ? 'var(--gray-400)' : 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                color: '#fff',
                cursor: (cloning || !cloneName.trim()) ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              {cloning ? 'Cloning...' : 'Clone Template'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Clone Success & Setup Instructions Modal */}
      {showCloneSuccessModal && clonedTemplateName && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          padding: '0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--gray-200)',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#fff',
              margin: 0
            }}>
              ✅ Template Cloned Successfully!
            </h3>
          </div>
          
          <div style={{
            padding: '1.5rem'
          }}>
            <p style={{
              color: 'var(--gray-700)',
              marginBottom: '0.75rem',
              fontSize: '0.9375rem',
              lineHeight: '1.6'
            }}>
              Template <strong>"{clonedTemplateName}"</strong> has been created successfully with all fields and AI configurations copied.
            </p>
            
            {clonedTemplateState && (
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '0.375rem 0.75rem',
                  backgroundColor: '#1e40af',
                  color: '#ffffff',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  📍 {US_STATES.find(s => s.value === clonedTemplateState)?.label || clonedTemplateState}
                </span>
              </div>
            )}

            <div style={{
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{
                color: '#92400e',
                fontWeight: 600,
                marginBottom: '0.5rem',
                fontSize: '0.875rem'
              }}>
                ⚠️ Remember to set up markdown export for this template
              </p>
            </div>

            {/* Step 1: Create markdown export file */}
            <div style={{
              background: 'var(--gray-50)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <p style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--gray-900)',
                marginTop: 0,
                marginBottom: '0.5rem'
              }}>
                Step 1: Create the markdown export file
              </p>
              <p style={{
                fontSize: '0.8125rem',
                color: 'var(--gray-600)',
                marginBottom: '0.75rem',
                lineHeight: '1.5'
              }}>
                Create a new file with this template structure:
              </p>
              <div style={{
                background: '#1e1e1e',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '0.75rem',
                overflow: 'auto'
              }}>
                <code style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#d4d4d4',
                  display: 'block',
                  whiteSpace: 'pre',
                  lineHeight: '1.5'
                }}>
{`/**
 * Markdown Export for ${clonedTemplateName}
 */

export function generateMarkdown(templateData, fields, fieldValues) {
  let markdown = '';
  
  // Helper to get field value by name
  const getFieldValue = (fieldName) => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return '';
    return fieldValues[field.id] || '';
  };
  
  // TODO: Build your markdown output here
  // Use getFieldValue('Field Name') to access values
  
  return markdown;
}`}
                </code>
              </div>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--gray-600)',
                margin: 0
              }}>
                Save as:{' '}
                <code style={{
                  background: 'var(--gray-200)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '3px',
                  fontFamily: 'monospace'
                }}>
                  src/lib/markdown-export/{clonedTemplateName.toLowerCase().replace(/[^a-z0-9]/g, '')}MarkdownExport.js
                </code>
              </p>
            </div>

            {/* Step 2: Add import */}
            <div style={{
              background: 'var(--gray-50)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <p style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--gray-900)',
                marginTop: 0,
                marginBottom: '0.5rem'
              }}>
                Step 2: Add import to CreateNewLesson.jsx
              </p>
              <p style={{
                fontSize: '0.8125rem',
                color: 'var(--gray-600)',
                marginBottom: '0.75rem',
                lineHeight: '1.5'
              }}>
                Add this line around <strong>line 31</strong>, after the other markdown export imports:
              </p>
              <div style={{
                background: '#1e1e1e',
                borderRadius: '6px',
                padding: '0.75rem',
                overflow: 'auto'
              }}>
                <code style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#d4d4d4',
                  display: 'block',
                  lineHeight: '1.5'
                }}>
{`import { generateMarkdown as generate${clonedTemplateName.replace(/[^a-zA-Z0-9]/g, '')}Markdown } from '../../lib/markdown-export/${clonedTemplateName.toLowerCase().replace(/[^a-z0-9]/g, '')}MarkdownExport';`}
                </code>
              </div>
            </div>

            {/* Step 3: Add to map */}
            <div style={{
              background: 'var(--gray-50)',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <p style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--gray-900)',
                marginTop: 0,
                marginBottom: '0.5rem'
              }}>
                Step 3: Add to templateNameToFunctionMap
              </p>
              <p style={{
                fontSize: '0.8125rem',
                color: 'var(--gray-600)',
                marginBottom: '0.75rem',
                lineHeight: '1.5'
              }}>
                Add this entry around <strong>line 220</strong> in the <code style={{
                  background: 'var(--gray-200)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '3px',
                  fontFamily: 'monospace'
                }}>templateNameToFunctionMap</code> object:
              </p>
              <div style={{
                background: '#1e1e1e',
                borderRadius: '6px',
                padding: '0.75rem',
                overflow: 'auto'
              }}>
                <code style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#d4d4d4',
                  display: 'block',
                  whiteSpace: 'pre',
                  lineHeight: '1.5'
                }}>
{`    const templateNameToFunctionMap = {
      'Additional Reading Practice': generateAdditionalReadingPracticeMarkdown,
      '${clonedTemplateName}': generate${clonedTemplateName.replace(/[^a-zA-Z0-9]/g, '')}Markdown,
      // Future templates will be added here manually
    };`}
                </code>
              </div>
            </div>
          </div>
          
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--gray-200)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => {
                setShowCloneSuccessModal(false);
                setClonedTemplateName(null);
                setClonedTemplateState(null);
                // Navigate to edit the new template
                const newTemplate = lessonTypes.find(t => t.name === clonedTemplateName);
                if (newTemplate) {
                  navigate(`/create-new-lesson-type?id=${newTemplate.id}`);
                }
              }}
              style={{
                padding: '0.5rem 1.25rem',
                border: 'none',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              Open New Template
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Cleanup Reminder Modal */}
      {showCleanupModal && deletedTemplateName && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '100%',
          padding: '0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--gray-200)',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff',
            borderRadius: '12px 12px 0 0'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600
            }}>
              ⚠️ Don't Forget to Clean Up!
            </h3>
          </div>
          
          <div style={{ padding: '1.5rem' }}>
            <p style={{
              margin: '0 0 1rem 0',
              color: 'var(--gray-700)',
              fontSize: '0.9375rem',
              lineHeight: '1.5'
            }}>
              Template "<strong>{deletedTemplateName}</strong>" has been deleted from the database.
            </p>
            
            <p style={{
              margin: '0 0 1rem 0',
              color: 'var(--gray-700)',
              fontSize: '0.9375rem',
              lineHeight: '1.5'
            }}>
              <strong>Remember to manually remove these files from your codebase:</strong>
            </p>

            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <ol style={{
                margin: 0,
                paddingLeft: '1.5rem',
                color: '#92400e',
                fontSize: '0.875rem',
                lineHeight: '1.6'
              }}>
                <li style={{ marginBottom: '0.5rem' }}>
                  Delete the markdown export file from{' '}
                  <code style={{
                    backgroundColor: '#fff',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    fontFamily: 'monospace'
                  }}>
                    src/lib/markdown-export/
                  </code>
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                  Remove the import statement from{' '}
                  <code style={{
                    backgroundColor: '#fff',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    fontFamily: 'monospace'
                  }}>
                    CreateNewLesson.jsx
                  </code>
                </li>
                <li>
                  Remove the entry from{' '}
                  <code style={{
                    backgroundColor: '#fff',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    fontFamily: 'monospace'
                  }}>
                    templateNameToFunctionMap
                  </code>{' '}
                  in {' '}
                  <code style={{
                    backgroundColor: '#fff',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    fontFamily: 'monospace'
                  }}>
                    CreateNewLesson.jsx
                  </code>{' '}
                </li>
              </ol>
            </div>
          </div>
          
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--gray-200)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => {
                setShowCleanupModal(false);
                setDeletedTemplateName(null);
              }}
              style={{
                padding: '0.5rem 1.25rem',
                border: 'none',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
