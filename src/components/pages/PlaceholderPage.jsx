import React from 'react';
import { useOutletContext } from 'react-router-dom';
import HeroSection from '../layout/HeroSection';

export default function PlaceholderPage({ title }) {
  const { session, profile } = useOutletContext() || {};
  
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <HeroSection session={session} profile={profile} />
      
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1rem',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: '#fff',
          margin: '0 0 1rem 0',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          {title}
        </h2>
        <p style={{
          fontSize: '1.125rem',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          This page is coming soon.
        </p>
      </div>
    </div>
  );
}
