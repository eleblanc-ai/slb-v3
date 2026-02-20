import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import ProtectedRoute from '../../components/auth/ProtectedRoute';

function FakeLayout() {
  return <Outlet context={{ profile: { role: 'designer' } }} />;
}

function renderWithRoute(roles, path = '/protected') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<FakeLayout />}>
          <Route index element={<div>Home</div>} />
          <Route
            path="protected"
            element={
              <ProtectedRoute roles={roles}>
                <div>Secret Page</div>
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('renders children when user role matches', () => {
    renderWithRoute(['designer', 'admin']);
    expect(screen.getByText('Secret Page')).toBeInTheDocument();
  });

  it('redirects to / when user role does not match', () => {
    renderWithRoute(['admin']);
    expect(screen.queryByText('Secret Page')).not.toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders children when no roles required', () => {
    renderWithRoute(null);
    expect(screen.getByText('Secret Page')).toBeInTheDocument();
  });
});
