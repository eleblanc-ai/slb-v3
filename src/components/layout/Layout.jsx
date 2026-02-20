import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import '../../styles/Layout.css';

export default function Layout({ session, profile, onLogout }) {
  return (
    <div className="home-page">
      <Header session={session} profile={profile} onLogout={onLogout} />
      <main style={{ paddingBottom: '80px', minHeight: 'calc(100vh - 140px)' }}>
        <Outlet context={{ session, profile }} />
      </main>
      <Footer session={session} profile={profile} />
    </div>
  );
}
