import { useState } from 'react';
import { X, ChevronLeft, Copy, Check, Loader, MessageSquare } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { mapDatabaseFields } from '../../services/batchLessonEngine';

const SKIP_TYPES = new Set(['section_header', 'image', 'mcqs', 'vocabulary_words']);

/**
 * PromptGeneratorModal — Select lesson templates, then generate a Claude prompt
 * that users can paste into Claude to convert their source material into
 * the batch markdown format.
 */
export default function PromptGeneratorModal({ visible, onClose, templates, profile }) {
  const [step, setStep] = useState('select'); // 'select' | 'prompt'
  const [selected, setSelected] = useState({}); // { templateId: true }
  const [loading, setLoading] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [copied, setCopied] = useState(false);

  const isAdmin = profile?.role === 'admin';

  // Filter out in_progress templates for non-admins
  const visibleTemplates = isAdmin
    ? templates
    : templates.filter((t) => t.status !== 'in_progress');

  const toggleTemplate = (id) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  };

  const handleReset = () => {
    setStep('select');
    setPromptText('');
    setCopied(false);
  };

  const handleClose = () => {
    setStep('select');
    setSelected({});
    setPromptText('');
    setCopied(false);
    onClose();
  };

  /* ─── Generate the prompt ─── */

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const selectedTemplates = templates.filter((t) => selected[t.id]);

      // Fetch fields for each selected template
      const templateFields = {};
      for (const tmpl of selectedTemplates) {
        const { data, error } = await supabase
          .from('lesson_template_fields')
          .select('*')
          .eq('lesson_template_id', tmpl.id)
          .order('field_order', { ascending: true });
        if (error) throw error;
        templateFields[tmpl.id] = mapDatabaseFields(data);
      }

      const prompt = buildPrompt(selectedTemplates, templateFields);
      setPromptText(prompt);
      setStep('prompt');
    } catch (err) {
      console.error('Failed to generate prompt:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = promptText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const anySelected = Object.keys(selected).length > 0;

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          maxWidth: step === 'prompt' ? '800px' : '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow:
            '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.3s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {step === 'prompt' && (
              <button
                onClick={handleReset}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  margin: 0,
                  color: '#1e293b',
                }}
              >
                {step === 'prompt' ? 'Your Claude Prompt' : 'Generate Claude Prompt'}
              </h2>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  margin: '0.25rem 0 0',
                }}
              >
                {step === 'prompt'
                  ? 'Copy this prompt and paste it into Claude along with your source material'
                  : 'Select the lesson templates you want to create lessons for'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {step === 'select' ? (
            /* ──────── TEMPLATE SELECTION STEP ──────── */
            <div>
              {visibleTemplates.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>
                  No templates available.
                </p>
              ) : (
                visibleTemplates.map((tmpl) => {
                  const isSelected = !!selected[tmpl.id];
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => toggleTemplate(tmpl.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '0.5rem',
                        border: `1px solid ${isSelected ? '#93c5fd' : '#e2e8f0'}`,
                        background: isSelected ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                          background: isSelected ? '#3b82f6' : '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s',
                        }}
                      >
                        {isSelected && (
                          <Check size={12} style={{ color: '#fff', strokeWidth: 3 }} />
                        )}
                      </div>

                      {/* Template info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                            {tmpl.name}
                          </span>
                          {tmpl.status === 'in_progress' && (
                            <span
                              style={{
                                fontSize: '0.625rem',
                                color: '#d97706',
                                background: '#fffbeb',
                                border: '1px solid #fcd34d',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              In Progress
                            </span>
                          )}
                        </div>
                        {tmpl.category && (
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              color: '#64748b',
                              background: '#f1f5f9',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {tmpl.category}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* ──────── PROMPT DISPLAY STEP ──────── */
            <div>
              <pre
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  color: '#334155',
                  maxHeight: '60vh',
                  overflowY: 'auto',
                  margin: 0,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                }}
              >
                {promptText}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div />
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleClose}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#374151',
                background: '#fff',
                border: '2px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {step === 'prompt' ? 'Close' : 'Cancel'}
            </button>
            {step === 'select' ? (
              <button
                onClick={handleGenerate}
                disabled={!anySelected || loading}
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#fff',
                  background:
                    anySelected && !loading
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)'
                      : '#d1d5db',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: anySelected && !loading ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                {loading ? (
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <MessageSquare size={14} />
                )}
                Generate Prompt
              </button>
            ) : (
              <button
                onClick={handleCopy}
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#fff',
                  background: copied
                    ? '#16a34a'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Prompt builder ─── */

function buildPrompt(selectedTemplates, templateFields) {
  const totalLessons = selectedTemplates.length;

  let prompt = '';
  prompt += `I need you to convert my source material into a specific markdown format for lesson creation. `;
  prompt += `Create ${totalLessons} lesson${totalLessons !== 1 ? 's' : ''} using the format below.\n\n`;
  prompt += `Each lesson must follow this exact structure with \`#Field Name\` headers. `;
  prompt += `Separate multiple lessons with \`---\` on its own line.\n\n`;
  prompt += `IMPORTANT RULES:\n`;
  prompt += `- Every lesson MUST start with a \`#Template Name\` header specifying which template it uses.\n`;
  prompt += `- Use the EXACT field names shown below as headers (e.g., \`#Selection\`, \`#Grade Band\`).\n`;
  prompt += `- For fields with a fixed set of options, use one of the listed values EXACTLY.\n`;
  prompt += `- Leave out any optional fields you don't have information for.\n`;
  prompt += `- Do not invent or hallucinate information — only use what is provided in the source material.\n\n`;

  // Describe each template
  for (const tmpl of selectedTemplates) {
    const fields = templateFields[tmpl.id] || [];
    const importableFields = fields.filter(
      (f) => f.importable && !SKIP_TYPES.has(f.type)
    );

    prompt += `${'='.repeat(60)}\n`;
    prompt += `TEMPLATE: ${tmpl.name}`;
    prompt += `\n${'='.repeat(60)}\n\n`;

    const required = importableFields.filter((f) => f.requiredForGeneration && !f.aiEnabled);
    const optional = importableFields.filter((f) => !f.requiredForGeneration || f.aiEnabled);

    if (required.length > 0) {
      prompt += `REQUIRED FIELDS (must be filled for each lesson):\n\n`;
      for (const field of required) {
        prompt += formatFieldDescription(field);
      }
      prompt += '\n';
    }

    if (optional.length > 0) {
      prompt += `OPTIONAL FIELDS (include if you have the information):\n\n`;
      for (const field of optional) {
        prompt += formatFieldDescription(field);
      }
      prompt += '\n';
    }
  }

  // Example output
  prompt += `${'='.repeat(60)}\n`;
  prompt += `EXAMPLE OUTPUT FORMAT\n`;
  prompt += `${'='.repeat(60)}\n\n`;

  const firstTemplate = selectedTemplates[0];
  const firstFields = templateFields[firstTemplate.id] || [];
  const exampleFields = firstFields.filter(
    (f) => f.importable && !SKIP_TYPES.has(f.type) && f.requiredForGeneration && !f.aiEnabled
  );

  prompt += `#Template Name\n${firstTemplate.name}\n\n`;
  for (const field of exampleFields.slice(0, 5)) {
    prompt += `#${field.name}\n${getExampleValue(field)}\n\n`;
  }

  if (totalLessons > 1) {
    prompt += `---\n\n`;
    prompt += `#Template Name\n${selectedTemplates.length > 1 ? selectedTemplates[1].name : firstTemplate.name}\n\n`;
    prompt += `#${exampleFields[0]?.name || 'Selection'}\n[Next lesson's value here]\n\n`;
    prompt += `[...continue with remaining fields...]\n\n`;
  }

  prompt += `${'='.repeat(60)}\n\n`;
  prompt += `Now, here is my source material:\n\n`;
  prompt += `[PASTE YOUR CONTENT HERE]`;

  return prompt;
}

function formatFieldDescription(field) {
  let desc = `  #${field.name}`;

  switch (field.type) {
    case 'text':
    case 'long_text':
      desc += ` — Plain text`;
      break;
    case 'rich_text':
      desc += ` — Text (plain text or HTML)`;
      break;
    case 'dropdown':
      if (field.options?.length > 0) {
        desc += ` — Choose ONE of: ${field.options.join(', ')}`;
      } else {
        desc += ` — Dropdown selection`;
      }
      break;
    case 'grade_band_selector':
      if (field.options?.length > 0) {
        desc += ` — Choose ONE of: ${field.options.join(', ')}`;
      } else {
        desc += ` — Grade band`;
      }
      break;
    case 'theme_selector':
      if (field.options?.length > 0) {
        desc += ` — Choose ONE of: ${field.options.join(', ')}`;
      } else {
        desc += ` — Theme selection`;
      }
      break;
    case 'checklist':
      desc += ` — List, one item per line`;
      if (field.options?.length > 0) {
        desc += `. Options: ${field.options.join(', ')}`;
      }
      break;
    case 'assign_standards':
      desc += ` — Standard codes separated by semicolons (e.g., CCSS.RI.7.1; CCSS.RI.7.2)`;
      break;
    default:
      desc += ` — Text`;
  }

  desc += '\n';
  return desc;
}

function getExampleValue(field) {
  switch (field.type) {
    case 'dropdown':
    case 'grade_band_selector':
    case 'theme_selector':
      return field.options?.[0] || '[Select a value]';
    case 'checklist':
      return field.options?.slice(0, 2).join('\n') || 'Item 1\nItem 2';
    case 'assign_standards':
      return 'CCSS.RI.7.1';
    case 'rich_text':
      return '[Your text content here]';
    default:
      return '[Your value here]';
  }
}
