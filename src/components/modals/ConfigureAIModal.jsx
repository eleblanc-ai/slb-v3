import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { APP_CONFIG } from '../../config';
import { buildFullPrompt } from '../../lib/promptBuilder';

/**
 * ConfigureAIModal - Modal for configuring AI generation settings for a field
 */
export default function ConfigureAIModal({ 
  visible, 
  onClose, 
  field,
  lessonTemplateId,
  lessonId,
  allFields = [],
  onSave,
  fieldValues = {},
  mode = 'template' // 'template' or 'lesson'
}) {
  const [prompt, setPrompt] = useState('');
  const [individualPrompt, setIndividualPrompt] = useState('');
  const [systemInstructions, setSystemInstructions] = useState('');
  const [contextInstructions, setContextInstructions] = useState('');
  const [formatRequirements, setFormatRequirements] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const loadConfiguration = useCallback(async () => {
    const defaultSystemInstructions = 'You are an AI assistant helping to create educational content. Be clear, concise, and age-appropriate.';
    const defaultContextInstructions = 'Use the following context from other fields to inform your generation:';
    const defaultFormatReqs = 'Return plain text without markdown formatting.';
    
    try {
      let configData = null;
      
      // In lesson mode, check user_ai_config first
      if (mode === 'lesson' && lessonId) {
        console.log('🔍 Checking for lesson-specific AI config');
        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('user_ai_config')
          .eq('id', lessonId)
          .single();
        
        if (!lessonError && lessonData?.user_ai_config && lessonData.user_ai_config[field.id]) {
          console.log('✅ Loading lesson-specific AI config');
          configData = lessonData.user_ai_config[field.id];
        }
      }
      
      // Fall back to template config if no lesson-specific config
      if (!configData) {
        console.log('📥 Loading template AI config');
        const { data, error } = await supabase
          .from('lesson_template_fields')
          .select('ai_prompt, ai_individual_prompt, ai_context_field_ids, ai_system_instructions, ai_context_instructions, ai_format_requirements')
          .eq('id', field.id)
          .single();
        
        if (!error && data) {
          configData = data;
        }
      }
      
      if (configData) {
        setPrompt(configData.ai_prompt || `Generate content for the ${field.name} field.`);
        setIndividualPrompt(configData.ai_individual_prompt || '');
        setSystemInstructions(configData.ai_system_instructions || defaultSystemInstructions);
        setContextInstructions(configData.ai_context_instructions || defaultContextInstructions);
        setFormatRequirements(configData.ai_format_requirements || defaultFormatReqs);
        setSelectedFields(configData.ai_context_field_ids || []);
      } else {
        setPrompt(`Generate content for the ${field.name} field.`);
        setIndividualPrompt('');
        setSystemInstructions(defaultSystemInstructions);
        setContextInstructions(defaultContextInstructions);
        setFormatRequirements(defaultFormatReqs);
        setSelectedFields([]);
      }
    } catch (err) {
      console.error('Error loading AI config:', err);
      setPrompt(`Generate content for the ${field.name} field.`);
      setIndividualPrompt('');
      setSystemInstructions(defaultSystemInstructions);
      setContextInstructions(defaultContextInstructions);
      setFormatRequirements(defaultFormatReqs);
      setSelectedFields([]);
    }
    
    setLoading(false);
  }, [field?.id, field?.name, mode, lessonId]);

  useEffect(() => {
    if (visible && field) {
      setLoading(true);
      setPrompt('');
      setIndividualPrompt('');
      setSystemInstructions('');
      setContextInstructions('');
      setFormatRequirements('');
      setSelectedFields([]);
      setShowPreview(false);
      loadConfiguration();
    } else if (!visible) {
      setPrompt('');
      setSystemInstructions('');
      setContextInstructions('');
      setFormatRequirements('');
      setSelectedFields([]);
      setShowPreview(false);
      setLoading(false);
    }
  }, [visible, field?.id, loadConfiguration]);

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Only save to database in template mode
      if (mode === 'template') {
        const { error } = await supabase
          .from('lesson_template_fields')
          .update({
            ai_prompt: prompt || null,
            ai_individual_prompt: individualPrompt || null,
            ai_context_field_ids: selectedFields.length > 0 ? selectedFields : null,
            ai_system_instructions: systemInstructions || null,
            ai_context_instructions: contextInstructions || null,
            ai_format_requirements: formatRequirements || null
          })
          .eq('id', field.id);
        
        if (error) throw error;
      }
      
      // Always call onSave callback to notify parent component
      if (onSave) {
        onSave({
          prompt,
          individualPrompt,
          contextFields: selectedFields,
          systemInstructions,
          contextInstructions,
          formatRequirements,
          selectedFieldIds: selectedFields
        });
      }
      
      onClose();
    } catch (err) {
      console.error('Error saving AI config:', err);
      alert('Failed to save AI configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (fieldId) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const selectAll = () => {
    setSelectedFields(
      allFields
        .filter(f => f.id !== field?.id)
        .map(f => f.id)
    );
  };

  const resetAll = () => {
    setPrompt(`Generate content for the ${field?.name} field.`);
    setIndividualPrompt('');
    setSystemInstructions('You are an AI assistant helping to create educational content. Be clear, concise, and age-appropriate.');
    setContextInstructions('Use the following context from other fields to inform your generation:');
    setFormatRequirements('Return plain text without markdown formatting.');
    setSelectedFields([]);
  };

  // Build prompt preview - must be before conditional return
  const promptPreview = useMemo(() => {
    // Read field values from localStorage
    const storedFieldValues = JSON.parse(localStorage.getItem('fieldValues') || '{}');
    
    return buildFullPrompt({
      systemInstructions,
      prompt,
      formatRequirements,
      contextInstructions,
      selectedFieldIds: selectedFields,
      allFields,
      fieldValues: storedFieldValues
    });
  }, [prompt, systemInstructions, contextInstructions, formatRequirements, selectedFields, allFields]);

  if (!visible || !field) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: `blur(${APP_CONFIG.modals.backdropBlur})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        maxWidth: '1400px',
        width: '95%',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #fafafa, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
            }}>
              ⚡
            </div>
            <div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--gray-900)',
                margin: 0,
                lineHeight: 1.2
              }}>
                Configure AI Generation
              </h2>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)',
                marginTop: '0.25rem'
              }}>
                <strong style={{ color: 'var(--primary)' }}>{field.name}</strong>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowPreview(!showPreview)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: showPreview ? 'var(--primary)' : 'var(--gray-700)',
                background: '#fff',
                border: `2px solid ${showPreview ? 'var(--primary)' : 'var(--gray-300)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = showPreview ? '#eff6ff' : 'var(--gray-50)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
              }}
            >
              <Eye size={16} />
              Preview
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--gray-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-100)';
                e.currentTarget.style.color = 'var(--gray-900)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--gray-500)';
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          background: 'var(--gray-50)',
          minHeight: 0
        }}>
          {showPreview ? (
            <div style={{
              width: '100%',
              padding: '2rem',
              overflowY: 'auto',
              background: '#fafafa',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center'
            }}>
              <div style={{
                maxWidth: '900px',
                width: '100%',
                background: '#fff',
                border: '2px solid var(--gray-200)',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--gray-700)',
                  marginBottom: '1.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  paddingBottom: '1rem',
                  borderBottom: '2px solid var(--gray-200)'
                }}>
                  Full Prompt Preview
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  fontFamily: 'ui-monospace, monospace',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--gray-700)',
                  lineHeight: '1.8',
                  background: 'var(--gray-50)',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--gray-200)'
                }}>
                  {promptPreview}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{
                width: '65%',
                padding: '1.5rem',
                overflowY: 'auto',
                background: '#fff',
                minHeight: 0
              }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                    Loading configuration...
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--gray-900)',
                        display: 'block',
                        marginBottom: '0.5rem'
                      }}>
                        System Instructions
                      </label>
                      <textarea
                        value={systemInstructions}
                        onChange={(e) => setSystemInstructions(e.target.value)}
                        placeholder="e.g., You are an AI assistant..."
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid var(--gray-200)',
                          borderRadius: '8px',
                          fontSize: '0.8125rem',
                          fontFamily: 'system-ui',
                          color: 'var(--gray-900)',
                          backgroundColor: '#fff',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          resize: 'vertical',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{
                      marginBottom: '1.5rem',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      padding: '1.25rem',
                      borderRadius: '12px',
                      border: '2px solid #60a5fa'
                    }}>
                      <label style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#1e40af',
                        display: 'block',
                        marginBottom: '0.5rem'
                      }}>
                        Field Prompt
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Example: Generate..."
                        rows={5}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #93c5fd',
                          borderRadius: '8px',
                          fontSize: '0.8125rem',
                          fontFamily: 'system-ui',
                          color: 'var(--gray-900)',
                          backgroundColor: '#fff',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          resize: 'vertical',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {field?.type === 'mcqs' && (
                      <div style={{
                        marginBottom: '1.5rem',
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: '2px solid #86efac'
                      }}>
                        <label style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#166534',
                          display: 'block',
                          marginBottom: '0.5rem'
                        }}>
                          Individual Question Prompt (Optional)
                        </label>
                        <p style={{
                          fontSize: '0.75rem',
                          color: '#15803d',
                          marginBottom: '0.75rem',
                          lineHeight: 1.5
                        }}>
                          This prompt will be used when regenerating a single question. If left blank, the main prompt will be used with "Generate 1 multiple choice question" instead of "Generate 5 multiple choice questions".
                        </p>
                        <textarea
                          value={individualPrompt}
                          onChange={(e) => setIndividualPrompt(e.target.value)}
                          placeholder="Example: Generate 1 multiple choice question..."
                          rows={4}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #86efac',
                            borderRadius: '8px',
                            fontSize: '0.8125rem',
                            fontFamily: 'system-ui',
                            color: 'var(--gray-900)',
                            backgroundColor: '#fff',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--gray-900)',
                        display: 'block',
                        marginBottom: '0.5rem'
                      }}>
                        Format Requirements
                      </label>
                      <textarea
                        value={formatRequirements}
                        onChange={(e) => setFormatRequirements(e.target.value)}
                        placeholder="e.g., Return only plain text..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid var(--gray-200)',
                          borderRadius: '8px',
                          fontSize: '0.8125rem',
                          fontFamily: 'system-ui',
                          color: 'var(--gray-900)',
                          backgroundColor: '#fff',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          resize: 'vertical',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {selectedFields.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--gray-900)',
                          display: 'block',
                          marginBottom: '0.5rem'
                        }}>
                          Context Instructions
                        </label>
                        <textarea
                          value={contextInstructions}
                          onChange={(e) => setContextInstructions(e.target.value)}
                          placeholder="e.g., Use the following context..."
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid var(--gray-200)',
                            borderRadius: '8px',
                            fontSize: '0.8125rem',
                            fontFamily: 'system-ui',
                            color: 'var(--gray-900)',
                            backgroundColor: '#fff',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                            resize: 'vertical',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{
                width: '35%',
                padding: '1.5rem',
                overflowY: 'auto',
                background: '#fafafa',
                borderLeft: '1px solid var(--gray-200)',
                minHeight: 0
              }}>
                <div style={{
                  background: '#fff',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '2px solid var(--gray-200)'
                }}>
                  <label style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--gray-900)',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}>
                    Context Fields
                  </label>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#059669',
                      marginBottom: '0.5rem'
                    }}>
                      DESIGNER
                    </div>
                    <div style={{
                      border: '2px solid #10b981',
                      borderRadius: '8px',
                      background: '#f0fdf4',
                      padding: '0.75rem'
                    }}>
                      {allFields.filter(f => f.fieldFor === 'designer' && f.id !== field.id).length === 0 ? (
                        <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem', margin: 0 }}>
                          No designer fields
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {allFields.filter(f => f.fieldFor === 'designer' && f.id !== field.id).map(contextField => (
                            <label key={contextField.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.625rem',
                              background: selectedFields.includes(contextField.id) ? '#d1fae5' : '#fff',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.8125rem'
                            }}>
                              <input
                                type="checkbox"
                                checked={selectedFields.includes(contextField.id)}
                                onChange={() => toggleField(contextField.id)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              />
                              <span>{contextField.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#7c3aed',
                      marginBottom: '0.5rem'
                    }}>
                      BUILDER
                    </div>
                    <div style={{
                      border: '2px solid #7c3aed',
                      borderRadius: '8px',
                      background: '#faf5ff',
                      padding: '0.75rem'
                    }}>
                      {allFields.filter(f => f.fieldFor === 'builder' && f.id !== field.id).length === 0 ? (
                        <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem', margin: 0 }}>
                          No builder fields
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {allFields.filter(f => f.fieldFor === 'builder' && f.id !== field.id).map(contextField => (
                            <label key={contextField.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.625rem',
                              background: selectedFields.includes(contextField.id) ? '#ede9fe' : '#fff',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.8125rem'
                            }}>
                              <input
                                type="checkbox"
                                checked={selectedFields.includes(contextField.id)}
                                onChange={() => toggleField(contextField.id)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              />
                              <span>{contextField.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--gray-600)',
                    marginTop: '0.75rem',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--gray-200)',
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to right, #fafafa, #ffffff)'
        }}>
          <button
            onClick={resetAll}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#ef4444',
              background: '#fff',
              border: '2px solid var(--gray-200)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Reset All
          </button>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--gray-700)',
                background: '#fff',
                border: '2px solid var(--gray-300)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.5rem 1.5rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#fff',
                background: saving ? 'var(--gray-400)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {saving ? 'Saving...' : (mode === 'lesson' ? 'Save Lesson Config' : 'Save Configuration')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
