import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { APP_CONFIG } from '../../config';

export default function SetPassword({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          password_set: true
        }
      });

      if (updateError) throw updateError;

      onComplete();
    } catch (error) {
      setError(error.message || 'Failed to set password');
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
            Set Your Password
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1rem' }}>
            Create a secure password for your account
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
                htmlFor="password" 
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1f2a44',
                  marginBottom: '0.5rem'
                }}
              >
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d0dce8',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                placeholder="Enter your password"
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
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label 
                htmlFor="confirmPassword" 
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1f2a44',
                  marginBottom: '0.5rem'
                }}
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d0dce8',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                placeholder="Confirm your password"
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
              {loading ? 'Setting Password...' : 'Set Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
