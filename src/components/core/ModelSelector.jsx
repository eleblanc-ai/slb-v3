import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const AI_MODELS = [
  { id: 'claude-sonnet-4-20250514', label: '🤖 Claude Sonnet 4', short: 'Claude Sonnet 4' },
  { id: 'gpt-4o', label: '🤖 GPT-4o', short: 'GPT-4o' },
];

/**
 * AI model selector dropdown with portal.
 *
 * Props:
 *  - selectedModel   – current model id
 *  - onModelChange   – (modelId) => void
 */
export default function ModelSelector({ selectedModel, onModelChange }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);

  const current = AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--gray-500)' }}>
        {' '}
        🤖 AI Model
      </span>
      <div style={{ position: 'relative' }}>
        <button
          ref={buttonRef}
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: '#fff',
            color: 'var(--gray-700)',
            border: '1px solid var(--gray-300)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            minWidth: '130px',
            justifyContent: 'space-between',
          }}
        >
          <span>{current.short}</span>
          <ChevronDown
            size={14}
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s',
            }}
          />
        </button>
        {open &&
          buttonRef.current &&
          createPortal(
            <>
              {/* Invisible overlay to close dropdown when clicking outside */}
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 99998,
                }}
                onClick={() => setOpen(false)}
              />
              <div
                style={{
                  position: 'fixed',
                  top: buttonRef.current.getBoundingClientRect().bottom + 4,
                  left: buttonRef.current.getBoundingClientRect().left,
                  width: 150,
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                  zIndex: 99999,
                  overflow: 'hidden',
                }}
              >
                {AI_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: 'none',
                      background: selectedModel === model.id ? '#f3f4f6' : '#fff',
                      color: '#374151',
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        selectedModel === model.id ? '#f3f4f6' : '#fff')
                    }
                  >
                    {model.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}
      </div>
    </div>
  );
}
