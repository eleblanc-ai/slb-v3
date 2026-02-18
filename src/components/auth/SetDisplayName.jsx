import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { APP_CONFIG } from '../../config';

export default function SetDisplayName({ userId, defaultDisplayName = '', onComplete, onSignOut }) {
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDisplayName(defaultDisplayName);
  }, [defaultDisplayName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      onComplete();
    } catch (error) {
      setError(error.message || 'Failed to save display name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      paddingTop: APP_CONFIG.auth.paddingTop,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: APP_CONFIG.auth.formMaxWidth,
        margin: '0 auto',
        padding: '0 1rem'
      }}>
        {/* Logo/Title Section */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: '600',
            color: 'white',
            marginBottom: '0.5rem'
          }}>
            Welcome!
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1rem' }}>
            Let's set up your profile
          </p>
        </div>

        {/* Form Card */}
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          border: 'none',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label 
                htmlFor="displayName" 
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1f2a44',
                  marginBottom: '0.5rem'
                }}
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d0dce8',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                placeholder="Enter your display name"
                required
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d0dce8';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginTop: '0.5rem'
              }}>
                This is how your name will appear in the app
              </p>
            </div>

            {error && (
              <div style={{
                background: '#fef2f2',
                color: '#991b1b',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
                border: '1px solid #fecaca'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: loading ? '#93c5fd' : '#3b82f6',
                color: 'white',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '500',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => {
                if (!loading) e.target.style.background = '#2563eb';
              }}
              onMouseOut={(e) => {
                if (!loading) e.target.style.background = '#3b82f6';
              }}
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                style={{
                  width: '100%',
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  color: '#2563eb',
                  borderRadius: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  border: '1px solid #bfdbfe',
                  cursor: 'pointer'
                }}
              >
                Sign out
              </button>
            )}

     
          </form>
        </div>
      </div>
    </div>
  );
}
