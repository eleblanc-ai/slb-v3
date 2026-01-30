import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Layout, Files, Book, ChevronRight } from 'lucide-react';
import { APP_CONFIG } from '../../config';
import { filterLinksByRole } from '../../lib/roleUtils';

const iconMap = {
  sparkles: Sparkles,
  layout: Layout,
  files: Files,
  book: Book,
};

export default function HeroSection({ session, profile }) {
  const userRole = profile?.role;
  const isAuthenticated = !!session;
  const visibleHeroLinks = filterLinksByRole(APP_CONFIG.heroLinks, userRole, isAuthenticated);

  return (
    <section className="hero" style={{ marginTop: APP_CONFIG.hero.marginTop }}>
      <div className="hero-content">
        <h1 className="hero-title" style={{ fontSize: APP_CONFIG.hero.titleFontSize }}>
          {APP_CONFIG.hero.title}{' '}
          <span className="gradient-text">{APP_CONFIG.hero.titleHighlight}</span>
        </h1>
        <p className="hero-subtitle">
          {APP_CONFIG.hero.subtitle}
        </p>
        {visibleHeroLinks.length > 0 && (
          <div className="hero-actions">
            {visibleHeroLinks.map((link, index) => {
              const Icon = iconMap[link.icon];
              const className = link.style === 'primary' ? 'btn-hero-primary' : 'btn-hero-secondary';
              
              return (
                <Link key={index} to={link.url} className={className}>
                  {Icon && <Icon size={20} />}
                  {link.label}
                  <ChevronRight size={20} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
