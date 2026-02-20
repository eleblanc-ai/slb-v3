import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToastProvider, { ToastContext } from '../../components/core/ToastProvider';
import { useToast } from '../../hooks/useToast';

function TestComponent() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Saved!')}>Show Success</button>
      <button onClick={() => toast.error('Failed!')}>Show Error</button>
    </div>
  );
}

describe('ToastProvider + useToast', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <span>Hello</span>
      </ToastProvider>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('shows a success toast when triggered', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('shows an error toast when triggered', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Failed!')).toBeInTheDocument();
  });

  it('removes toast when close button clicked', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Saved!')).toBeInTheDocument();

    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });
});
