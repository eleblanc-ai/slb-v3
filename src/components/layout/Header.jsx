import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, User, ChevronDown, Shield } from 'lucide-react';
import { APP_CONFIG } from '../../config';
import favicon from '../../assets/favicon.ico';
import { filterLinksByRole } from '../../lib/roleUtils';

export default function Header({ session, profile, onLogout }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const userRole = profile?.role;
  const isAuthenticated = !!session;
  const visibleUserMenuItems = filterLinksByRole(APP_CONFIG.header.userMenu, userRole, isAuthenticated);

  const iconMap = {
    shield: Shield,
    logout: LogOut,
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target) && userMenuOpen) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <img src={favicon} alt="" className="logo-icon" />
          <span className="logo-text">{APP_CONFIG.title}</span>
        </Link>
        
        <nav className="nav desktop-nav">
          {/* Show user menu if logged in, otherwise show sign in button */}
          {session ? (
            <div style={{ position: 'relative' }} ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
              >
                <User size={16} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {profile?.display_name || session.user.email}
                </span>
                <ChevronDown size={16} />
              </button>
              
              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  background: 'white',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  minWidth: '200px',
                  zIndex: 1000
                }}>
                  {visibleUserMenuItems.map((item, index) => {
                    const Icon = iconMap[item.icon];
                    const isLastItem = index === visibleUserMenuItems.length - 1;
                    
                    if (item.action === 'logout') {
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setUserMenuOpen(false);
                            onLogout();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--gray-700)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.2s',
                            borderBottom: isLastItem ? 'none' : '1px solid rgba(0, 0, 0, 0.05)'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {Icon && <Icon size={16} />}
                          {item.label}
                        </button>
                      );
                    }
                    
                    return (
                      <Link
                        key={index}
                        to={item.url}
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          color: 'var(--gray-700)',
                          textDecoration: 'none',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          borderBottom: isLastItem ? 'none' : '1px solid rgba(0, 0, 0, 0.05)',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {Icon && <Icon size={16} />}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <Link to={APP_CONFIG.header.button.url}>
              <button className="btn-primary">{APP_CONFIG.header.button.label}</button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
