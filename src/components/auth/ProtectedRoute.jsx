import { useOutletContext, Navigate } from 'react-router-dom';

/**
 * Route guard that checks user role before rendering child routes.
 * Wrap route elements to restrict access by role.
 *
 * @param {string[]} roles - Allowed roles (e.g. ['admin', 'designer'])
 * @param {React.ReactNode} children - The page component to render
 */
export default function ProtectedRoute({ roles, children }) {
  const { profile } = useOutletContext();

  // No role restriction — any authenticated user is fine
  if (!roles || roles.length === 0) return children;

  // Check if user's role is in the allowed list
  if (!profile?.role || !roles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
