import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { FileText, Beaker, Calendar, User, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { US_STATES } from '../../config/usStates';

export default function BrowseLessons() {
  const navigate = useNavigate();
  const { session, profile } = useOutletContext() || {};
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

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

      // Get unique user IDs and template IDs
      const userIds = [...new Set(lessonsData?.map(l => l.created_by).filter(Boolean))];
      const templateIds = [...new Set(lessonsData?.map(l => l.lesson_template_id).filter(Boolean))];
      
      // Fetch profiles for creators
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);
        
        profiles?.forEach(p => {
          profileMap[p.id] = p.display_name;
        });
      }

      // Fetch lesson templates for category and state info
      let templateMap = {};
      if (templateIds.length > 0) {
        const { data: templates } = await supabase
          .from('lesson_templates')
          .select('id, category, state')
          .in('id', templateIds);
        
        templates?.forEach(t => {
          templateMap[t.id] = { category: t.category, state: t.state };
        });
      }

      // Add creator and template info to lessons
      const lessonsWithCreator = lessonsData?.map(lesson => ({
        ...lesson,
        creator: { display_name: profileMap[lesson.created_by] },
        template: templateMap[lesson.lesson_template_id] || {}
      }));

      setLessons(lessonsWithCreator || []);
    } catch (error) {
      console.error('Error loading lessons:', error);
      alert('Failed to load lessons. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLessonClick = (lesson) => {
    if (lesson.is_test) {
      // Open test lesson in template creator
      navigate(`/create-new-lesson-type?id=${lesson.lesson_template_id}&testLessonId=${lesson.id}`);
    } else {
      // For non-test lessons, you could navigate to a lesson editor/viewer
      // For now, just log it
      console.log('Open regular lesson:', lesson);
      alert('Regular lesson viewing coming soon!');
    }
  };

  const handleStatusChange = async (lessonId, newStatus) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('lessons')
        .update({ status: newStatus })
        .eq('id', lessonId);

      if (error) throw error;

      // Update local state
      setLessons(prev => prev.map(lesson => 
        lesson.id === lessonId ? { ...lesson, status: newStatus } : lesson
      ));

      setEditingStatus(null);
    } catch (error) {
      console.error('Error updating lesson status:', error);
      alert('Failed to update lesson status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem'
            }}>
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              onClick={() => handleLessonClick(lesson)}
              style={{
                backgroundColor: '#fff',
                border: '1px solid var(--gray-200)',
                borderRadius: '12px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.borderColor = 'var(--gray-200)';
              }}
            >
              {/* State Badge (if exists) */}
              {lesson.template?.state && (
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
                    {US_STATES.find(s => s.value === lesson.template.state)?.label || lesson.template.state}
                  </span>
                </div>
              )}

              {/* Content ID and Template Name */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: 'var(--gray-900)',
                    margin: 0
                  }}>
                    {lesson.designer_responses?.["Content ID"] || lesson.id.slice(0, 8) + "..."}
                  </h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--gray-500)',
                    margin: '0.25rem 0 0 0'
                  }}>
                    {lesson.template_name}
                  </p>
                  {/* Category */}
                  {lesson.template?.category && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--gray-400)',
                      margin: '0.25rem 0 0 0'
                    }}>
                      {lesson.template.category}
                    </p>
                  )}
                </div>
                {lesson.is_test && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    marginLeft: '0.5rem',
                    flexShrink: 0
                  }}>
                    <Beaker size={12} />
                    Test
                  </span>
                )}
              </div>



              {/* Metadata */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: 'var(--gray-600)'
              }}>
                {lesson.creator?.display_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={14} />
                    <span>{lesson.creator.display_name}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={14} />
                  <span>Updated: {new Date(lesson.updated_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Field Counts */}
              <div style={{
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--gray-200)',
                display: 'flex',
                gap: '1rem',
                fontSize: '0.875rem',
                color: 'var(--gray-600)'
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>
                    {Object.keys(lesson.designer_responses || {}).length}
                  </span> designer fields
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>
                    {Object.keys(lesson.builder_responses || {}).length}
                  </span> builder fields
                </div>
              </div>
            </div>
          ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
