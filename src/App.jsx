import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import Layout from './components/layout/Layout';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './components/pages/HomePage';
import PlaceholderPage from './components/pages/PlaceholderPage';
import Login from './components/auth/Login';
import SetDisplayName from './components/auth/SetDisplayName';
import SetPassword from './components/auth/SetPassword';
import CreateNewLessonType from './components/pages/CreateNewLessonType';
import CreateNewLesson from './components/pages/CreateNewLesson';
import BrowseLessonTemplates from './components/pages/BrowseLessonTemplates';
import BrowseLessons from './components/pages/BrowseLessons';
import AdminDashboard from './components/pages/AdminDashboard';
import { APP_CONFIG } from './config';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [postLoginRedirect, setPostLoginRedirect] = useState(false);

  const detectPasswordRecovery = () => {
    if (typeof window === 'undefined') {
      return false;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const typeParam = searchParams.get('type') || hashParams.get('type');
    return typeParam === 'recovery';
  };

  const clearRecoveryParams = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.delete('type');
    url.searchParams.delete('code');
    window.history.replaceState({}, document.title, url.toString());
  };

  const fetchProfile = async (userId, forceLoading = true) => {
    // Only set loading state if we're forcing it (initial load)
    if (forceLoading) {
      setProfileLoading(true);
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // PGRST116 means no rows found, which is fine (new user)
        if (error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      // Silently handle errors - profile will just be null
      setProfile(null);
    } finally {
      if (forceLoading) {
        setProfileLoading(false);
      }
      setProfileChecked(true);
    }
  };

  useEffect(() => {
    // Check active session
    const hasRecoveryInUrl = detectPasswordRecovery();
    if (hasRecoveryInUrl) {
      setPasswordRecovery(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Session:', session);
      setSession(session);
      
      if (session?.user) {
        setProfileChecked(false);
        fetchProfile(session.user.id).finally(() => {
          setLoading(false);
        });
      } else {
        setProfileChecked(false);
        setPostLoginRedirect(true);
        setLoading(false);
      }
    });

    // Listen for auth changes - only update on actual changes (signed in/out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session);

      if (_event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }

      // Only update state if the session actually changed
      setSession((prevSession) => {
        // If the session hasn't actually changed, don't update
        if (prevSession?.user?.id === session?.user?.id) {
          // Session ID is the same, don't trigger any updates
          return prevSession;
        }
        
        // Session changed - fetch profile but don't show loading screen
        if (session?.user) {
          setProfileChecked(false);
          fetchProfile(session.user.id, false);
        } else {
          setProfile(null);
          setProfileChecked(false);
          setPostLoginRedirect(true);
        }
        
        return session;
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    // Session will be set by onAuthStateChange listener
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const handleDisplayNameComplete = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  const handlePasswordComplete = async () => {
    // Force refresh the session to get updated user metadata
    const { data: { session: newSession } } = await supabase.auth.getSession();
    if (newSession) {
      setSession(newSession);
    }
    setNeedsPassword(false);
    setPasswordRecovery(false);
    clearRecoveryParams();
  };

  // Check if user needs to set a password (invited users via magic link)
  useEffect(() => {
    const checkPasswordStatus = async () => {
      if (!session?.user) {
        setNeedsPassword(false);
        return;
      }

      const user = session.user;
      
      // If user doesn't have password_set flag, they need to set a password
      // This will be true for all invited users who haven't set a password yet
      const hasPasswordSet = user.user_metadata?.password_set === true;
      
      setNeedsPassword(!hasPasswordSet);
    };

    checkPasswordStatus();
  }, [session, profile]);

  useEffect(() => {
    if (session && postLoginRedirect) {
      const targetUrl = new URL(window.location.origin);
      window.history.replaceState({}, document.title, targetUrl.toString());
      setPostLoginRedirect(false);
    }
  }, [session, postLoginRedirect]);

  if (loading || profileLoading || (session && !profileChecked)) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: 'linear-gradient(to bottom, #f7faff, #eef3f9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            position: 'relative', 
            width: '5rem', 
            height: '5rem', 
            margin: '0 auto' 
          }}>
            {/* Outer ring */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '4px solid #bfdbfe'
            }}></div>
            {/* Spinning arc */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '4px solid transparent',
              borderTopColor: '#2563eb',
              animation: 'spin 1s linear infinite'
            }}></div>
            {/* Inner pulsing dot */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                background: '#2563eb',
                borderRadius: '50%',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}></div>
            </div>
          </div>
          <p style={{ 
            marginTop: '1.5rem', 
            color: '#5b6b8a', 
            fontWeight: 500 
          }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  // If user is in password recovery flow, show password form
  if (session && passwordRecovery) {
    return <SetPassword onComplete={handlePasswordComplete} />;
  }

  // If user needs to set a password (invited user), show password form
  if (session && needsPassword) {
    return <SetPassword onComplete={handlePasswordComplete} />;
  }

  // If user is logged in but doesn't have a display name, show the display name form
  if (session && profileChecked && (!profile || !profile.display_name)) {
    return <SetDisplayName userId={session.user.id} onComplete={handleDisplayNameComplete} />;
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout session={session} profile={profile} onLogout={handleLogout} />}>
          <Route index element={<HomePage />} />
          
          {/* Specific routes */}
          <Route path="/create-new-lesson-type" element={<CreateNewLessonType />} />
          <Route path="/create-new-lesson" element={<CreateNewLesson />} />
          <Route path="/browse-lesson-templates" element={<BrowseLessonTemplates />} />
          <Route path="/browse-lessons" element={<BrowseLessons />} />
          
          {/* Other header navigation routes */}
          {APP_CONFIG.header.navigation
            .filter(link => link.url !== '/create-new-lesson-type')
            .map((link, index) => (
              <Route 
                key={index} 
                path={link.url} 
                element={<PlaceholderPage title={link.label} />} 
              />
            ))}
          
          {/* Admin dashboard route */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          
          {/* Footer routes */}
          {APP_CONFIG.footer.links.map((link, index) => (
            <Route 
              key={index} 
              path={link.url} 
              element={<PlaceholderPage title={link.label} />} 
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
