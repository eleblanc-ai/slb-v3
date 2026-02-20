import { useEffect, useRef } from 'react';

/**
 * QuestionPromptsEditor — Tabbed MCQ question prompt editor (Q1–Q5).
 * Shows tab bar, per-question label/tooltip/standards/prompt.
 */

// Find the nearest scrollable ancestor by checking computed overflow
const findScrollParent = (el) => {
  let node = el?.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
};

// Auto-resize textarea to fit content, preserving scroll position
const autoResize = (el) => {
  if (!el) return;
  const scrollParent = findScrollParent(el);
  const savedScroll = scrollParent ? scrollParent.scrollTop : 0;
  // Temporarily add a sentinel char so scrollHeight accounts for trailing newlines
  const val = el.value;
  const endsWithNewline = val.endsWith('\n') || val.endsWith('\r');
  if (endsWithNewline) el.value = val + '.';
  el.style.height = 'auto';
  const h = el.scrollHeight;
  if (endsWithNewline) el.value = val;
  el.style.height = h + 'px';
  if (scrollParent) scrollParent.scrollTop = savedScroll;
};

// Strip TipTap HTML wrapping from DB values so textareas show clean plain text
const stripHtml = (val) => {
  if (!val || typeof val !== 'string') return val || '';
  const trimmed = val.trim();
  if (!/<\/?[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  // Not structured TipTap HTML — return as-is (plain text with literal tags)
  if (!/^<(?:p|h[1-6]|ul|ol|div|blockquote|table)\b/i.test(trimmed)) return trimmed;
  // 1. Strip actual HTML structure tags first.
  //    Entity-encoded tags (&lt;p&gt;) do NOT match /<[^>]*>/ so they survive.
  let text = trimmed
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  // 2. Decode entities to reveal literal tag names.
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
};

export default function QuestionPromptsEditor({
  questionPrompts,
  onChangeQuestionPrompts,
  activeTab,
  onChangeActiveTab,
  questionKeys,
  vocabStandards,
  mainIdeaStandards,
  mode,
}) {
  const containerRef = useRef(null);
  const setQField = (qKey, key, value) => {
    onChangeQuestionPrompts((prev) => ({
      ...prev,
      [qKey]: { ...prev[qKey], [key]: value },
    }));
  };

  // Auto-resize visible textarea on tab switch or when prompt values change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const visibleTextarea = containerRef.current.querySelector('textarea');
      // Only resize the textarea in the visible tab
      containerRef.current.querySelectorAll('textarea').forEach(ta => {
        if (ta.offsetParent !== null) autoResize(ta);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, questionPrompts]);

  return (
    <div
      ref={containerRef}
      style={{
        marginBottom: '1.5rem',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        padding: '1.25rem',
        borderRadius: '12px',
        border: '2px solid #86efac',
      }}
    >
      <label
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#166534',
          display: 'block',
          marginBottom: '0.5rem',
        }}
      >
        Question Prompts
      </label>
      <p style={{ fontSize: '0.75rem', color: '#15803d', marginBottom: '0.75rem', lineHeight: 1.5 }}>
        Each question has its own customizable prompt with a specific focus area. Click each tab to
        edit its prompt.
      </p>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #86efac',
          marginBottom: '1rem',
          background: '#f0fdf4',
          borderRadius: '8px 8px 0 0',
        }}
      >
        {questionKeys.map((key, index) => (
          <button
            key={key}
            type="button"
            onClick={() => onChangeActiveTab(index)}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              background: activeTab === index ? '#fff' : 'transparent',
              borderBottom:
                activeTab === index ? '3px solid #16a34a' : '3px solid transparent',
              color: activeTab === index ? '#166534' : '#15803d',
              fontWeight: activeTab === index ? 600 : 400,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            <span>{`Q${index + 1}`}</span>
            <span style={{ fontSize: 10, opacity: 0.8 }}>
              {questionPrompts[key]?.label || ''}
            </span>
          </button>
        ))}
      </div>

      {/* Per-question content */}
      {questionKeys.map((qKey, index) => (
        <div key={qKey} style={{ display: activeTab === index ? 'block' : 'none' }}>
          {/* Label & Tooltip — template mode only */}
          {mode === 'template' && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={greenLabel}>Tab Label</label>
                <input
                  type="text"
                  value={questionPrompts[qKey]?.label || ''}
                  onChange={(e) => setQField(qKey, 'label', e.target.value)}
                  placeholder="e.g., Central Idea"
                  style={greenInput}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={greenLabel}>Tooltip Description</label>
                <input
                  type="text"
                  value={questionPrompts[qKey]?.tooltip || ''}
                  onChange={(e) => setQField(qKey, 'tooltip', e.target.value)}
                  placeholder="e.g., Asks about the main idea or central claim"
                  style={greenInput}
                />
              </div>
            </div>
          )}

          {/* Standards checkboxes */}
          {(mode === 'template' ||
            (mode === 'lesson' &&
              (questionPrompts[qKey]?.includeVocabStandards ||
                questionPrompts[qKey]?.includeMainIdeaStandards))) && (
            <StandardsCheckboxes
              qKey={qKey}
              questionPrompts={questionPrompts}
              onChange={setQField}
              vocabStandards={vocabStandards}
              mainIdeaStandards={mainIdeaStandards}
              mode={mode}
            />
          )}

          <label style={{ ...greenLabel, marginBottom: '0.25rem' }}>
            Question {index + 1} Prompt
          </label>
          <textarea
            ref={autoResize}
            value={questionPrompts[qKey]?.prompt || ''}
            onChange={(e) => { setQField(qKey, 'prompt', e.target.value); autoResize(e.target); }}
            placeholder={`Enter the prompt for Question ${index + 1}...`}
            style={{
              width: '100%',
              minHeight: '180px',
              padding: '0.75rem',
              fontSize: '0.8125rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              border: '2px solid #86efac',
              borderRadius: '8px',
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.6,
              boxSizing: 'border-box',
              color: 'var(--gray-900)',
              background: '#fff',
              overflow: 'hidden',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Standards checkboxes sub-section ─── */

function StandardsCheckboxes({
  qKey,
  questionPrompts,
  onChange,
  vocabStandards,
  mainIdeaStandards,
  mode,
}) {
  const isLesson = mode === 'lesson';

  return (
    <div
      style={{
        marginBottom: '0.75rem',
        padding: '0.75rem',
        background: isLesson ? '#f8f9fa' : '#f0fdf4',
        borderRadius: '8px',
        border: isLesson ? '1px solid #dee2e6' : '1px solid #86efac',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: isLesson ? '#495057' : '#166534',
          marginBottom: '0.5rem',
        }}
      >
        Include Grade-Specific Standards {isLesson && '(Set by Template)'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {(mode === 'template' || questionPrompts[qKey]?.includeVocabStandards) && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: isLesson ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem',
              color: isLesson ? '#495057' : '#15803d',
            }}
          >
            <input
              type="checkbox"
              checked={questionPrompts[qKey]?.includeVocabStandards || false}
              onChange={(e) => onChange(qKey, 'includeVocabStandards', e.target.checked)}
              disabled={isLesson}
              style={{ cursor: isLesson ? 'not-allowed' : 'pointer' }}
            />
            <span>
              Include Vocabulary Standards ({vocabStandards.length > 0 ? vocabStandards.join('; ') : 'None'})
            </span>
          </label>
        )}
        {(mode === 'template' || questionPrompts[qKey]?.includeMainIdeaStandards) && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: isLesson ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem',
              color: isLesson ? '#495057' : '#15803d',
            }}
          >
            <input
              type="checkbox"
              checked={questionPrompts[qKey]?.includeMainIdeaStandards || false}
              onChange={(e) => onChange(qKey, 'includeMainIdeaStandards', e.target.checked)}
              disabled={isLesson}
              style={{ cursor: isLesson ? 'not-allowed' : 'pointer' }}
            />
            <span>
              Include Main Idea Standards ({mainIdeaStandards.length > 0 ? mainIdeaStandards.join('; ') : 'None'})
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

/* ─── Shared styles ─── */

const greenLabel = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#166534',
  display: 'block',
  marginBottom: '0.25rem',
};

const greenInput = {
  width: '100%',
  padding: '0.5rem',
  border: '2px solid #86efac',
  borderRadius: '6px',
  fontSize: '0.8125rem',
  color: 'var(--gray-900)',
  backgroundColor: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};
