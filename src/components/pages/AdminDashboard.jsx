import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { UserPlus, Users, Shield, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('builder');
  const [createApproved, setCreateApproved] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_profiles');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setCreateLoading(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call edge function to create user with explicit auth header
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: createEmail,
            password: createPassword,
            role: createRole,
            approved: createApproved,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setCreateSuccess(`User ${createEmail} created successfully!`);
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('builder');
      setCreateApproved(true);
      
      // Refresh user list
      fetchUsers();
      
      // Auto-hide form after 2 seconds
      setTimeout(() => {
        setShowCreateUser(false);
        setCreateSuccess('');
      }, 2000);
    } catch (error) {
      setCreateError(error.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' };
      case 'designer': return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' };
      case 'builder': return { bg: '#e0e7ff', color: '#3730a3', border: '#a5b4fc' };
      default: return { bg: '#f3f4f6', color: '#1f2937', border: '#d1d5db' };
    }
  };

  return (
    <div style={{ 
      minHeight: 'calc(100vh - 60px)',
      paddingTop: '2rem',
      paddingBottom: '4rem'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '0 2rem' 
      }}>
        {/* Page Header */}
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
              Admin Dashboard
            </h1>
            <p style={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              fontSize: '1.125rem',
              fontWeight: 500
            }}>
              Manage users and permissions
            </p>
          </div>
        </div>

        {/* Create User Button */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setShowCreateUser(!showCreateUser)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.2)';
            }}
          >
            <UserPlus size={18} />
            {showCreateUser ? 'Cancel' : 'Create New User'}
          </button>
        </div>

        {/* Create User Form */}
        {showCreateUser && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 700,
              color: 'var(--gray-900)',
              marginBottom: '1.5rem'
            }}>
              Create New User
            </h2>

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--gray-700)'
                }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid var(--gray-200)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--gray-200)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--gray-700)'
                }}>
                  Temporary Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Temporary password for user"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid var(--gray-200)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--gray-200)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--gray-700)'
                }}>
                  Role <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid var(--gray-200)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                    outline: 'none',
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
                  <option value="builder">Builder</option>
                  <option value="designer">Designer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--gray-700)'
                }}>
                  <input
                    type="checkbox"
                    checked={createApproved}
                    onChange={(e) => setCreateApproved(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  Approved (user can access immediately)
                </label>
              </div>

              {createError && (
                <div style={{
                  background: '#fef2f2',
                  color: '#991b1b',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  marginBottom: '1.5rem',
                  border: '1px solid #fecaca'
                }}>
                  {createError}
                </div>
              )}

              {createSuccess && (
                <div style={{
                  background: '#f0fdf4',
                  color: '#166534',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  marginBottom: '1.5rem',
                  border: '1px solid #bbf7d0'
                }}>
                  {createSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={createLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: createLoading ? '#93c5fd' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: createLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {createLoading ? 'Creating User...' : 'Create User'}
              </button>
            </form>
          </div>
        )}

        {/* Users List */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '2rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid var(--gray-200)'
          }}>
            <Users size={24} style={{ color: 'var(--primary)' }} />
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 700,
              color: 'var(--gray-900)',
              margin: 0
            }}>
              All Users <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>({users.length})</span>
            </h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
              No users found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {users.map((user) => {
                const roleColors = getRoleBadgeColor(user.role);
                return (
                  <div
                    key={user.id}
                    style={{
                      padding: '1.5rem',
                      border: '2px solid var(--gray-200)',
                      borderRadius: '12px',
                      backgroundColor: '#fff',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          marginBottom: '0.5rem'
                        }}>
                          <h3 style={{
                            fontSize: '1.125rem',
                            fontWeight: 600,
                            color: 'var(--gray-900)',
                            margin: 0
                          }}>
                            {user.display_name || 'No display name'}
                          </h3>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: roleColors.bg,
                            color: roleColors.color,
                            border: `1px solid ${roleColors.border}`,
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'capitalize'
                          }}>
                            {user.role}
                          </span>
                          {user.approved ? (
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#f0fdf4',
                              color: '#16a34a',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              <CheckCircle size={14} />
                              Approved
                            </span>
                          ) : (
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              <XCircle size={14} />
                              Pending
                            </span>
                          )}
                        </div>
                        <p style={{
                          fontSize: '0.875rem',
                          color: 'var(--gray-600)',
                          margin: 0
                        }}>
                          {user.id}
                        </p>
                        <p style={{
                          fontSize: '0.75rem',
                          color: 'var(--gray-500)',
                          margin: '0.25rem 0 0 0'
                        }}>
                          Created: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
