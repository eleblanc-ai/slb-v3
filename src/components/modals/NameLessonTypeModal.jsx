import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { US_STATES } from '../../config/usStates';
import { APP_CONFIG } from '../../config';
import { supabase } from '../../lib/supabaseClient';

export default function NameLessonTypeModal({ visible, onClose, onSave, initialName = '', initialCategory = 'Core ELA', initialState = '' }) {
  const navigate = useNavigate();
  const [lessonTypeName, setLessonTypeName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory);
  const [state, setState] = useState(initialState);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setLessonTypeName(initialName);
    setCategory(initialCategory);
    setState(initialState);
    setShowConfirmation(false);
  }, [initialName, initialCategory, initialState]);

  if (!visible) return null;

  const handleClose = () => {
    // Always show confirmation when trying to close
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }
    
    setLessonTypeName('');
    setCategory('Core ELA');
    setState('');
    setShowConfirmation(false);
    onClose();
  };

  const handleCancelConfirmed = () => {
    setLessonTypeName('');
    setCategory('Core ELA');
    setState('');
    setShowConfirmation(false);
    onClose();
    navigate('/');
  };

  const handleCancelDenied = () => {
    setShowConfirmation(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!lessonTypeName.trim()) {
      setErrorMessage('Please enter a lesson template name');
      return;
    }
    if (category === 'State-specific' && !state) {
      setErrorMessage('Please select a state');
      return;
    }

    // Check if lesson template already exists
    setChecking(true);
    try {
      const stateValue = category === 'State-specific' ? state : null;
      
      let query = supabase
        .from('lesson_templates')
        .select('id, name, category, state')
        .eq('name', lessonTypeName.trim())
        .eq('category', category);
      
      // Add state filter - match null for Core ELA, exact state for State-specific
      if (stateValue) {
        query = query.eq('state', stateValue);
      } else {
        query = query.is('state', null);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error checking for existing lesson template:', error);
        setErrorMessage('Error checking for existing lesson template. Please try again.');
        setChecking(false);
        return;
      }
      
      if (data && data.length > 0) {
        const existingType = data[0];
        let message = `A lesson type named "${existingType.name}" already exists`;
        if (existingType.category === 'State-specific' && existingType.state) {
          const stateName = US_STATES.find(s => s.value === existingType.state)?.label || existingType.state;
          message += ` for ${stateName}`;
        } else {
          message += ` in ${existingType.category}`;
        }
        message += '. Please choose a different name or category.';
        setErrorMessage(message);
        setChecking(false);
        return;
      }
      
      // No duplicate found, proceed
      onSave({
        name: lessonTypeName,
        category: category,
        state: stateValue
      });
      handleClose();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setErrorMessage('An error occurred. Please try again.');
    } finally {
      setChecking(false);
    }
  };

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
        borderRadius: '12px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--gray-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--gray-900)',
            margin: 0
          }}>
            {showConfirmation ? 'Cancel Lesson Template Creation?' : 'Name Your Lesson Template'}
          </h2>
        </div>

        {/* Content */}
        {showConfirmation ? (
          <div style={{ padding: '1.5rem' }}>
            <p style={{
              color: 'var(--gray-600)',
              fontSize: '1rem',
              marginBottom: '1.5rem',
              lineHeight: '1.5'
            }}>
              Are you sure you want to cancel creating this lesson template? All progress will be lost.
            </p>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={handleCancelDenied}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  color: 'var(--gray-700)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                }}
              >
                No, Keep Editing
              </button>
              <button
                type="button"
                onClick={handleCancelConfirmed}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px rgba(239, 68, 68, 0.2)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(239, 68, 68, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(239, 68, 68, 0.2)';
                }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '1.5rem' }}>
              <p style={{
                color: 'var(--gray-600)',
                fontSize: '0.875rem',
                marginBottom: '1.5rem'
              }}>
                Give your lesson template a descriptive name and select its category. You'll be able to add fields and configure it in the next step.
              </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--gray-700)'
              }}>
                Lesson Template Name
              </label>
              <input
                type="text"
                value={lessonTypeName}
                onChange={(e) => {
                  setLessonTypeName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g., Reading Comprehension, Math Worksheet, Lab Activity"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: `2px solid ${errorMessage ? '#ef4444' : 'var(--gray-200)'}`,
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = errorMessage ? '#ef4444' : 'var(--primary)';
                  e.currentTarget.style.boxShadow = errorMessage ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errorMessage ? '#ef4444' : 'var(--gray-200)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {errorMessage && (
                <p style={{
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#ef4444',
                  margin: '0.5rem 0 0 0'
                }}>
                  {errorMessage}
                </p>
              )}
            </div>

            <div style={{ marginBottom: category === 'State-specific' ? '1.5rem' : '0' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--gray-700)'
              }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (e.target.value === 'Core ELA') {
                    setState('');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid var(--gray-200)',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  backgroundColor: '#fff',
                  cursor: 'pointer'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-200)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <option value="Core ELA">Core ELA</option>
                <option value="State-specific">State-specific</option>
              </select>
            </div>

            {category === 'State-specific' && (
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--gray-700)'
                }}>
                  State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid var(--gray-200)',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    backgroundColor: '#fff',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--gray-200)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Select a state...</option>
                  {US_STATES.map((usState) => (
                    <option key={usState.value} value={usState.value}>
                      {usState.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid var(--gray-200)',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid var(--gray-300)',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: 'var(--gray-700)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-50)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={checking}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                background: checking 
                  ? 'var(--gray-400)' 
                  : 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: checking ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)'
              }}
              onMouseOver={(e) => {
                if (!checking) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (!checking) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.2)';
                }
              }}
            >
              {checking ? 'Checking...' : 'Continue'}
            </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
