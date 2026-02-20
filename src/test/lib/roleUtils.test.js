/**
 * Tests for filterLinksByRole() — navigation role gating.
 */

import { describe, it, expect } from 'vitest';
import { filterLinksByRole } from '../../lib/roleUtils';

const LINKS = [
  { label: 'Home', path: '/', roles: null },
  { label: 'Dashboard', path: '/dashboard', roles: ['admin', 'designer'] },
  { label: 'Admin', path: '/admin', roles: ['admin'] },
  { label: 'Builder', path: '/build', roles: ['builder', 'designer'] },
];

describe('filterLinksByRole', () => {
  it('shows all public links (roles: null) to unauthenticated users', () => {
    const result = filterLinksByRole(LINKS, null, false);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Home');
  });

  it('shows public + role-matched links to authenticated admin', () => {
    const result = filterLinksByRole(LINKS, 'admin', true);
    expect(result.map((l) => l.label)).toEqual(['Home', 'Dashboard', 'Admin']);
  });

  it('shows public + role-matched links to authenticated designer', () => {
    const result = filterLinksByRole(LINKS, 'designer', true);
    expect(result.map((l) => l.label)).toEqual(['Home', 'Dashboard', 'Builder']);
  });

  it('hides role-gated links from authenticated user with wrong role', () => {
    const result = filterLinksByRole(LINKS, 'viewer', true);
    expect(result.map((l) => l.label)).toEqual(['Home']);
  });

  it('hides all role-gated links from unauthenticated users', () => {
    const result = filterLinksByRole(LINKS, 'admin', false);
    // Even though role matches, isAuthenticated is false
    expect(result.map((l) => l.label)).toEqual(['Home']);
  });

  it('returns empty array for empty input', () => {
    expect(filterLinksByRole([], 'admin', true)).toEqual([]);
  });

  it('handles links with empty roles array', () => {
    const links = [{ label: 'Weird', path: '/x', roles: [] }];
    // Empty array means no role can match
    const result = filterLinksByRole(links, 'admin', true);
    expect(result).toHaveLength(0);
  });
});
