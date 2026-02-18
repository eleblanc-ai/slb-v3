import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { FileText, Beaker, Calendar, User, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { US_STATES } from '../../config/usStates';
import ConfirmModal from '../modals/ConfirmModal';

export default function BrowseLessons() {
  const navigate = useNavigate();
  const { session, profile } = useOutletContext() || {};
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lessonToDelete, setLessonToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      
      // First fetch lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .order('updated_at', { ascending: false });

      if (lessonsError) throw lessonsError;

      console.log('📦 Loaded lessons:', lessonsData);

      // Get unique user IDs and template IDs
      const userIds = [...new Set([
        ...lessonsData?.map(l => l.created_by).filter(Boolean),
        ...lessonsData?.map(l => l.updated_by).filter(Boolean)
      ])];
      const templateIds = [...new Set(lessonsData?.map(l => l.lesson_template_id).filter(Boolean))];
      
      console.log('👥 User IDs to fetch:', userIds);
      
      // Fetch profiles for creators
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);
        
        console.log('👤 Profiles fetched:', profiles);
        if (profileError) console.error('Profile fetch error:', profileError);
        
        profiles?.forEach(p => {
          if (p.display_name) {
            profileMap[p.id] = p.display_name;
          }
        });
      }
      
      console.log('👤 Profile map:', profileMap);

      // Fetch lesson templates for template name and state info
      let templateMap = {};
      if (templateIds.length > 0) {
        const { data: templates } = await supabase
          .from('lesson_templates')
          .select('id, name, state')
          .in('id', templateIds);
        
        templates?.forEach(t => {
          templateMap[t.id] = { name: t.name, state: t.state };
        });
      }

      // Fetch template fields to find Content ID field for each template
      let templateFieldsMap = {};
      if (templateIds.length > 0) {
        const { data: fields } = await supabase
          .from('lesson_template_fields')
          .select('id, name, lesson_template_id, field_for')
          .in('lesson_template_id', templateIds)
          .eq('field_for', 'designer');
        
        fields?.forEach(field => {
          if (!templateFieldsMap[field.lesson_template_id]) {
            templateFieldsMap[field.lesson_template_id] = [];
          }
          templateFieldsMap[field.lesson_template_id].push(field);
        });
      }

      // Add creator and template info to lessons
      const lessonsWithCreator = lessonsData?.map(lesson => {
        // Use created_by for the creator display
        const creatorId = lesson.created_by;
        const creatorName = profileMap[creatorId] || 'Unknown User';
        const updaterId = lesson.updated_by;
        const updaterName = profileMap[updaterId] || (updaterId ? 'Unknown User' : null);
        
        console.log(
          `Lesson ${lesson.id.slice(0, 8)}: creatorId=${creatorId?.slice(0, 8)}, creatorName=${creatorName}`
        );
        
        return {
          ...lesson,
          creator: { display_name: creatorName },
          updater: { display_name: updaterName },
          template: templateMap[lesson.lesson_template_id] || {},
          templateFields: templateFieldsMap[lesson.lesson_template_id] || []
        };
      });

      // Filter out test lessons for non-admin users
      const filteredLessons = profile?.role === 'admin' 
        ? lessonsWithCreator 
        : lessonsWithCreator?.filter(lesson => !lesson.is_test);

      setLessons(filteredLessons || []);
    } catch (error) {
      console.error('Error loading lessons:', error);
      if (error?.status === 401 || error?.status === 403) {
        await supabase.auth.signOut();
        return;
      }
      alert(`Failed to load lessons. ${error?.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const canDeleteLesson = (lesson) => {
    // User can only delete their own lessons
    return lesson.created_by === session?.user?.id;
  };

  const handleLessonClick = (lesson) => {
    if (lesson.is_test) {
      // Open test lesson in template creator
      navigate(`/create-new-lesson-type?id=${lesson.lesson_template_id}&testLessonId=${lesson.id}`);
    } else {
      // Open regular lesson in lesson editor
      navigate(`/create-new-lesson?templateId=${lesson.lesson_template_id}&lessonId=${lesson.id}`);
    }
  };

  const handleDeleteClick = (e, lesson) => {
    e.stopPropagation(); // Prevent card click
    setLessonToDelete(lesson);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!lessonToDelete) return;

    // Check permission before deleting
    if (!canDeleteLesson(lessonToDelete)) {
      alert('You do not have permission to delete this lesson.');
      setShowDeleteModal(false);
      setLessonToDelete(null);
      return;
    }

    try {
      // Delete associated images from storage
      const allResponses = {
        ...(lessonToDelete.designer_responses || {}),
        ...(lessonToDelete.builder_responses || {})
      };
      
      for (const value of Object.values(allResponses)) {
        if (value && typeof value === 'object' && value.url) {
          // Extract storage path from URL
          const url = value.url;
          if (url.includes('/storage/v1/object/public/lesson-images/')) {
            const path = url.split('/lesson-images/')[1];
            if (path) {
              await supabase.storage
                .from('lesson-images')
                .remove([path]);
            }
          }
        }
      }

      // Delete lesson from database
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonToDelete.id);

      if (error) throw error;

      // Remove from UI
      setLessons(lessons.filter(l => l.id !== lessonToDelete.id));
      setShowDeleteModal(false);
      setLessonToDelete(null);
    } catch (error) {
      console.error('Error deleting lesson:', error);
      alert('Failed to delete lesson. Please try again.');
    }
  };

  const renderLessonCard = (lesson) => {
    const formatName = (name) => {
      if (!name) return 'Unknown User';
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 1) return parts[0];
      const first = parts[0];
      const lastInitial = parts[parts.length - 1]?.[0];
      return lastInitial ? `${first} ${lastInitial}.` : first;
    };

    const allResponses = { ...(lesson.designer_responses || {}), ...(lesson.builder_responses || {}) };
    const thumbnailUrl = Object.values(allResponses).find(
      val => val && typeof val === 'object' && val.url && !val.url.startsWith('data:')
    )?.url;

    // Find Content ID field from template fields
    const contentIdField = lesson.templateFields?.find(
      field => field.name === 'Content ID' || 
               field.name.toLowerCase() === 'content id' ||
               field.name.toLowerCase().includes('content') && field.name.toLowerCase().includes('id')
    );
    
    // Get the actual Content ID value using the field ID
    const contentId = contentIdField && lesson.designer_responses?.[contentIdField.id]
      ? lesson.designer_responses[contentIdField.id]
      : `Lesson ${lesson.id.slice(0, 8)}`;

    return (
      <div
        key={lesson.id}
        onClick={() => handleLessonClick(lesson)}
        style={{
          backgroundColor: '#fff',
          border: '1px solid var(--gray-200)',
          borderRadius: '12px',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
        }}
      >
        {/* Delete Button */}
        {canDeleteLesson(lesson) && (
          <button
            onClick={(e) => handleDeleteClick(e, lesson)}
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#dc2626',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              zIndex: 2,
              backdropFilter: 'blur(4px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
            }}
            title="Delete lesson"
          >
            <Trash2 size={16} />
          </button>
        )}

        {/* Thumbnail */}
        <div style={{
          width: '100%',
          height: '200px',
          backgroundColor: 'var(--gray-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <FileText size={48} style={{ color: 'var(--gray-400)' }} />
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem' }}>
          <h3 style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: 'var(--gray-900)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {contentId}
          </h3>
          
          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--gray-600)',
            marginBottom: '0.25rem'
          }}>
            {lesson.template?.name || 'Unknown Template'}
          </div>

          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--gray-500)',
            marginBottom: '0.75rem'
          }}>
            {lesson.template?.state ? US_STATES.find(s => s.value === lesson.template.state)?.label || lesson.template.state : 'Core ELA'}
          </div>

          {/* Creator and timestamps */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '0.75rem'
          }}>
            <div style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--gray-200)',
              borderRadius: '0.5rem'
            }}>
              <div style={{
                fontSize: '0.6875rem',
                color: 'var(--gray-500)',
                marginBottom: '0.25rem'
              }}>
                Created by
              </div>
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--gray-800)',
                fontWeight: 600,
                marginBottom: '0.25rem'
              }}>
                {formatName(lesson.creator?.display_name)}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--gray-600)'
              }}>
                {new Date(lesson.created_at).toLocaleString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
            </div>

            <div style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--gray-200)',
              borderRadius: '0.5rem'
            }}>
              <div style={{
                fontSize: '0.6875rem',
                color: 'var(--gray-500)',
                marginBottom: '0.25rem'
              }}>
                Last updated
              </div>
              <div style={{
                fontSize: '0.8125rem',
                color: 'var(--gray-800)',
                fontWeight: 600,
                marginBottom: '0.25rem'
              }}>
                {lesson.updater?.display_name
                  ? formatName(lesson.updater.display_name)
                  : '—'}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--gray-600)'
              }}>
                {lesson.updated_at
                  ? new Date(lesson.updated_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })
                  : '—'}
              </div>
            </div>
          </div>

          {/* Response counts */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            fontSize: '0.75rem',
            color: 'var(--gray-600)'
          }}>
            <div>
              <span style={{ fontWeight: 600 }}>
                {Object.keys(lesson.designer_responses || {}).length}
              </span> designer
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>
                {Object.keys(lesson.builder_responses || {}).length}
              </span> builder
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <p style={{ color: 'var(--gray-500)' }}>Loading lessons...</p>
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
        {/* Header */}
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
              color: '#fff',
              marginBottom: '0.75rem'
            }}>
              Browse Lessons
            </h1>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1.125rem',
              fontWeight: 500
            }}>
              View and manage all lesson instances
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
          {/* Lessons Grid */}
          {lessons.length === 0 ? (
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
                No lessons found
              </p>
              <p style={{ fontSize: '0.875rem' }}>
                Create your first lesson to get started
              </p>
            </div>
          ) : (
            <>
              {/* Core Lessons Section */}
              {lessons.filter(l => !l.template?.state).length > 0 && (
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
                    Core Lessons
                  </h2>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem'
                  }}>
                    {lessons.filter(l => !l.template?.state).map(renderLessonCard)}
                  </div>
                </div>
              )}

              {/* State-Specific Lessons - Organized by State */}
              {lessons.filter(l => l.template?.state).length > 0 && (
                <>
                  {[...new Set(lessons.filter(l => l.template?.state).map(l => l.template.state))].sort().map(state => {
                    const stateLessons = lessons.filter(l => l.template?.state === state);
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
                            backgroundColor: '#3b82f6'
                          }}></span>
                          {stateLabel} Lessons
                        </h2>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '1rem'
                        }}>
                          {stateLessons.map(renderLessonCard)}
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
        <ConfirmModal
          title="Delete Lesson"
          message={`Are you sure you want to delete "${lessonToDelete?.designer_responses?.["Content ID"] || lessonToDelete?.id.slice(0, 8)}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setShowDeleteModal(false);
            setLessonToDelete(null);
          }}
          dangerous
        />
      )}
    </div>
  );
}
