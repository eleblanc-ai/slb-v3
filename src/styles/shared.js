/**
 * Shared style objects and helpers.
 *
 * Centralises the repeated inline-style patterns used across
 * page components, modals, and core UI elements.
 *
 * Usage:
 *   import { s, gradientButton, liftOnHover } from '../../styles/shared';
 *   <div style={s.modalOverlay}> … </div>
 *   <button style={gradientButton('#8b5cf6', '#7c3aed', '139, 92, 246')} …>
 */

/* ------------------------------------------------------------------ */
/*  Modal styles                                                       */
/* ------------------------------------------------------------------ */

export const modalOverlay = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  backdropFilter: 'blur(4px)',
};

export const modalCard = {
  background: '#fff',
  borderRadius: '16px',
  padding: '2rem',
  width: '90%',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
};

export const modalHeading = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: 'var(--gray-900)',
  margin: 0,
};

export const modalHeaderRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '1.5rem',
};

export const modalButtonRow = {
  display: 'flex',
  gap: '0.75rem',
  justifyContent: 'flex-end',
};

export const modalCloseButton = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--gray-500)',
  padding: '0.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  transition: 'all 0.2s',
};

/* ------------------------------------------------------------------ */
/*  Button styles                                                      */
/* ------------------------------------------------------------------ */

/**
 * Build a gradient toolbar button style.
 *
 * @param {string} from   – gradient start colour (hex)
 * @param {string} to     – gradient end colour (hex)
 * @param {string} rgb    – comma-separated rgb for box-shadow, e.g. '139, 92, 246'
 * @param {object} [overrides] – extra CSS properties
 */
export function gradientButton(from, to, rgb, overrides = {}) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.5rem 0.875rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: `0 2px 4px rgba(${rgb}, 0.25)`,
    ...overrides,
  };
}

/**
 * Returns onMouseEnter / onMouseLeave handlers that
 * lift the element on hover (translateY + deeper shadow).
 *
 * @param {string} rgb – comma-separated rgb for box-shadow
 * @param {() => boolean} [guard] – optional guard; skip effect when it returns true
 */
export function liftOnHover(rgb, guard) {
  return {
    onMouseEnter: (e) => {
      if (guard && guard()) return;
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = `0 4px 8px rgba(${rgb}, 0.4)`;
    },
    onMouseLeave: (e) => {
      if (guard && guard()) return;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = `0 2px 4px rgba(${rgb}, 0.25)`;
    },
  };
}

export const outlineButton = {
  padding: '0.625rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--gray-700)',
  background: '#fff',
  border: '2px solid var(--gray-300)',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

export const dangerOutlineButton = {
  ...outlineButton,
  color: '#ef4444',
  border: '2px solid #ef4444',
};

/* ------------------------------------------------------------------ */
/*  Page layout                                                        */
/* ------------------------------------------------------------------ */

export const pageBackground = {
  minHeight: 'calc(100vh - 60px)',
  background:
    'linear-gradient(180deg, #2b6fda 0%, #5aa3f5 65%, #eef6ff 88%, #ffffff 100%)',
  padding: '2rem 1rem 4rem',
};

export const pageMaxWidth = {
  maxWidth: '1600px',
  margin: '0 auto',
};

export const pageHeaderRelative = {
  position: 'relative',
  marginBottom: '2.5rem',
};

export const backButton = {
  position: 'absolute',
  left: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  background: 'rgba(255, 255, 255, 0.1)',
  color: '#fff',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '8px',
  padding: '0.5rem 0.75rem',
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

export const backButtonHover = {
  onMouseEnter: (e) => {
    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
  },
  onMouseLeave: (e) => {
    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
  },
};

export const pageTitle = {
  fontSize: '2.5rem',
  fontWeight: 700,
  color: '#fff',
  margin: 0,
};

export const pageSubtitle = {
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: '1.125rem',
  fontWeight: 500,
  marginBottom: 0,
};

export const stateBadge = {
  display: 'inline-block',
  padding: '0.375rem 0.875rem',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  color: '#fff',
  borderRadius: '9999px',
  fontSize: '0.875rem',
  fontWeight: 600,
  border: '1px solid rgba(255, 255, 255, 0.3)',
  backdropFilter: 'blur(8px)',
};

export const toolbarContainer = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  borderRadius: '12px',
  padding: '1rem',
  marginBottom: '1.5rem',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

export const toolbarRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
};

export const fieldsCard = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  borderRadius: '16px',
  padding: '2rem',
  minHeight: '500px',
  boxShadow:
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

export const requiredFieldIndicator = {
  textAlign: 'right',
  marginBottom: '1rem',
  fontSize: '0.75rem',
  color: '#ef4444',
  fontStyle: 'italic',
};

/**
 * Build the responsive field layout grid/flex styles.
 */
export function fieldsLayout(layoutMode) {
  return {
    display: layoutMode === 'side-by-side' ? 'grid' : 'flex',
    gridTemplateColumns: layoutMode === 'side-by-side' ? '1fr 1fr' : undefined,
    flexDirection: layoutMode === 'stacked' ? 'column' : undefined,
    gap: layoutMode === 'side-by-side' ? '2rem' : '2.5rem',
  };
}

/* ------------------------------------------------------------------ */
/*  Warning / validation boxes                                         */
/* ------------------------------------------------------------------ */

export const warningBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '1rem 1.25rem',
  marginBottom: '1rem',
};

export const warningText = {
  color: '#991b1b',
  fontWeight: 600,
  fontSize: '0.875rem',
  margin: '0 0 0.5rem 0',
};

export const warningList = {
  margin: 0,
  paddingLeft: '1.25rem',
  color: '#b91c1c',
  fontSize: '0.875rem',
};

/* ------------------------------------------------------------------ */
/*  Cover image / preview                                              */
/* ------------------------------------------------------------------ */

export const coverImageContainer = {
  marginBottom: '2rem',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
};

export const coverImageFull = {
  width: '100%',
  height: 'auto',
  display: 'block',
};

export const markdownBody = {
  fontSize: '1rem',
  lineHeight: '1.75',
  color: 'var(--gray-800)',
};

/* ------------------------------------------------------------------ */
/*  Loading state                                                      */
/* ------------------------------------------------------------------ */

export const loadingContainer = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const loadingText = {
  color: 'var(--gray-600)',
  fontSize: '1.125rem',
};

/* ------------------------------------------------------------------ */
/*  Close-button hover helpers for modals                              */
/* ------------------------------------------------------------------ */

export const closeButtonHover = {
  onMouseEnter: (e) => {
    e.currentTarget.style.backgroundColor = 'var(--gray-100)';
    e.currentTarget.style.color = 'var(--gray-700)';
  },
  onMouseLeave: (e) => {
    e.currentTarget.style.backgroundColor = 'transparent';
    e.currentTarget.style.color = 'var(--gray-500)';
  },
};

/* ------------------------------------------------------------------ */
/*  Markdown preview <style> tag content (CSS string)                  */
/* ------------------------------------------------------------------ */

export const markdownPreviewCSS = `
  .markdown-preview h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 1.5rem 0 1rem;
    color: var(--gray-900);
  }
  .markdown-preview h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 1.25rem 0 0.75rem;
    color: var(--gray-900);
  }
  .markdown-preview h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
    color: #3b82f6;
  }
  .markdown-preview h4 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0.875rem 0 0.5rem;
    color: var(--gray-900);
  }
  .markdown-preview p {
    margin: 1rem 0;
  }
  .markdown-preview ul, .markdown-preview ol {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }
  .markdown-preview li {
    margin: 0.25rem 0;
  }
  .markdown-preview strong {
    font-weight: 600;
  }
  .markdown-preview code {
    background-color: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.875em;
  }
  .markdown-preview pre {
    background-color: #f3f4f6;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }
  .markdown-preview pre code {
    background: none;
    padding: 0;
  }
  .markdown-preview blockquote {
    border-left: 4px solid #e5e7eb;
    padding-left: 1rem;
    margin: 1rem 0;
    color: var(--gray-600);
  }
`;
