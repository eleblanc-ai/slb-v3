import React from 'react';
import { useOutletContext } from 'react-router-dom';
import HeroSection from '../layout/HeroSection';

export default function HomePage() {
  const { session, profile } = useOutletContext() || {};
  return <HeroSection session={session} profile={profile} />;
}
