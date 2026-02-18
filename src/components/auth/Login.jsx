import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { APP_CONFIG } from '../../config';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login');

  const isAllowedSignupEmail = (value) => {
    const normalized = value.trim().toLowerCase();
    return normalized.endsWith('@thinkcerca.com') || normalized.endsWith('@protonmail.com');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!isAllowedSignupEmail(email)) {
          throw new Error('Please use your @thinkcerca.com or @protonmail.com email address to sign up.');
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              password_set: true,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data?.session) {
          onLogin();
        } else {
          setSuccess('Check your email to confirm your account before signing in.');
        }
      } else if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
        });

        if (error) {
          throw error;
        }

        setSuccess('Check your email for a magic link to sign in.');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

        if (error) {
          throw error;
        }

        setSuccess('Check your email for a password reset link.');
      } else {
        console.log('=== LOGIN ATTEMPT ===');
        console.log('Email:', email);
        console.log('Password length:', password.length);
        console.log('Password first char:', password[0]);
        console.log('Sending to Supabase...');
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        console.log('Login response:', { data, error });

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        if (data.session) {
          console.log('Login successful!');
          onLogin();
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      setError(error.message || 'Invalid email or password');
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
            Smart Lesson Builder
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1rem' }}>
            {mode === 'signup'
              ? 'Create your account to continue'
              : mode === 'magic'
                ? 'Send a magic link to sign in'
                : mode === 'reset'
                  ? 'Send a password reset link'
                  : 'Please log in to continue'}
          </p>
        </div>

        {/* Login Card */}
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
                htmlFor="email" 
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#1f2a44',
                  marginBottom: '0.5rem'
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d0dce8',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                placeholder="Enter your email"
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

            {(mode === 'login' || mode === 'signup') && (
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
                  Password
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
            )}

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

            {success && (
              <div style={{
                background: '#ecfeff',
                color: '#155e75',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
                border: '1px solid #a5f3fc'
              }}>
                {success}
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
              {loading
                ? (mode === 'signup'
                  ? 'Signing up...'
                  : mode === 'magic'
                    ? 'Sending link...'
                    : mode === 'reset'
                      ? 'Sending reset...'
                      : 'Signing in...')
                : (mode === 'signup'
                  ? 'Sign Up'
                  : mode === 'magic'
                    ? 'Send Magic Link'
                    : mode === 'reset'
                      ? 'Send Reset Link'
                      : 'Sign In')}
            </button>

            <div style={{
              marginTop: '1rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              color: '#4b5563'
            }}>
              {mode === 'signup' ? (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setSuccess('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Sign in
                  </button>
                </span>
              ) : (
                <span>
                  Need an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setSuccess('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Sign up
                  </button>
                </span>
              )}
            </div>

            <div style={{
              marginTop: '0.75rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              color: '#4b5563'
            }}>
              <button
                type="button"
                onClick={() => {
                  setMode('magic');
                  setError('');
                  setSuccess('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Send magic link
              </button>
              <span style={{ margin: '0 0.5rem', color: '#9ca3af' }}>|</span>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setError('');
                  setSuccess('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Reset password
              </button>
              {(mode === 'magic' || mode === 'reset') && (
                <>
                  <span style={{ margin: '0 0.5rem', color: '#9ca3af' }}>|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setSuccess('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Back to sign in
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
