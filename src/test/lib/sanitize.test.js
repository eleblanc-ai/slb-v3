import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../../lib/sanitize';

describe('sanitizeHTML', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeHTML(null)).toBe('');
    expect(sanitizeHTML(undefined)).toBe('');
    expect(sanitizeHTML('')).toBe('');
  });

  it('allows safe HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHTML(input)).toBe(input);
  });

  it('strips script tags', () => {
    const input = '<p>Safe</p><script>alert("xss")</script>';
    expect(sanitizeHTML(input)).toBe('<p>Safe</p>');
  });

  it('strips event handlers', () => {
    const input = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onerror');
  });

  it('strips javascript: URLs', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('javascript');
  });

  it('allows allowed attributes', () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    expect(sanitizeHTML(input)).toContain('href="https://example.com"');
  });

  it('strips data attributes', () => {
    const input = '<div data-evil="true">Content</div>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('data-evil');
  });
});
