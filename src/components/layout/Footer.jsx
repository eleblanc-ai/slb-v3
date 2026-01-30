import React from 'react';
import { Link } from 'react-router-dom';
import { APP_CONFIG } from '../../config';
import { filterLinksByRole } from '../../lib/roleUtils';

export default function Footer({ session, profile }) {
  const userRole = profile?.role;
  const isAuthenticated = !!session;
  const visibleFooterLinks = filterLinksByRole(APP_CONFIG.footer.links, userRole, isAuthenticated);

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links center-on-mobile">
          {visibleFooterLinks.map((link, index) => (
            <Link key={index} to={link.url}>{link.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
