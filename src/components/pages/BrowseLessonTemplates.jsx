import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { US_STATES } from '../../config/usStates';
import { FileText, ArrowLeft, X } from 'lucide-react';

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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.5rem'
            }}>
              {lessonTypes.map((lessonType) => {
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
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteClick(e, lessonType)}
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
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
                      zIndex: 10,
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
