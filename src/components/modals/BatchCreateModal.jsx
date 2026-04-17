import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Sparkles, Loader } from 'lucide-react';
import { parseBatchMarkdown } from '../../import/batchMarkdownParser';
import { applyImportToFields } from '../../import/markdownImporter';
import { mapDatabaseFields } from '../../services/batchLessonEngine';
import { supabase } from '../../services/supabaseClient';
import FieldRenderer from '../core/FieldRenderer';
import ModelSelector from '../core/ModelSelector';

/**
 * BatchCreateModal — Upload a combined .md file, validate template matches,
 * review & edit imported values, then kick off batch lesson creation.
 *
 * Two-step flow:
 *   1. 'upload' — drop a .md file, validate template names
 *   2. 'review' — inspect/edit imported field values before generating
 */
export default function BatchCreateModal({ visible, onClose, templates, session, onBatchStart }) {
  const [file, setFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [resolvedLessons, setResolvedLessons] = useState([]);
  const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5-20251001');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Review step state
  const [step, setStep] = useState('upload'); // 'upload' | 'review'
  const [reviewData, setReviewData] = useState([]); // per-lesson review info
  const [loadingReview, setLoadingReview] = useState(false);
  const [expandedLessons, setExpandedLessons] = useState(new Set());

  const handleFile = useCallback(
    (f) => {
      if (!f) return;
      setFile(f);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const result = parseBatchMarkdown(text);
        setParseResult(result);

        const resolved = result.lessons.map((lesson) => {
          const match = templates.find(
            (t) => t.name.toLowerCase() === lesson.templateName.toLowerCase()
          );
          return {
            ...lesson,
            template: match || null,
            error: match ? null : `Template "${lesson.templateName}" not found`,
            fieldCount: Object.keys(lesson.parsedFields).length,
          };
        });
        setResolvedLessons(resolved);
      };
      reader.readAsText(f);
    },
    [templates]
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && (f.name.endsWith('.md') || f.name.endsWith('.txt'))) {
      handleFile(f);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setResolvedLessons([]);
    setStep('upload');
    setReviewData([]);
    setExpandedLessons(new Set());
  };

  const allValid =
    resolvedLessons.length > 0 && resolvedLessons.every((l) => l.template !== null);

  /* ─── Review step: fetch fields, run import, build review data ─── */

  const handleReviewImports = async () => {
    if (!allValid) return;
    setLoadingReview(true);

    try {
      // Fetch fields for each unique template (cache to avoid duplicate queries)
      const fieldsCache = {};
      for (const lesson of resolvedLessons) {
        const tid = lesson.template.id;
        if (!fieldsCache[tid]) {
          const { data, error } = await supabase
            .from('lesson_template_fields')
            .select('*')
            .eq('lesson_template_id', tid)
            .order('field_order', { ascending: true });
          if (error) throw error;
          fieldsCache[tid] = mapDatabaseFields(data);
        }
      }

      // For each lesson: import fields and build review info
      const reviews = [];
      for (const lesson of resolvedLessons) {
        const fields = fieldsCache[lesson.template.id];

        // In batch review, force ALL fields importable so we don't silently
        // drop values the user explicitly provided in the markdown.
        const fieldsForImport = fields.map((f) => ({ ...f, importable: true }));
        const { values, missingFields, notFoundStandards } =
          await applyImportToFields(lesson.parsedFields, fieldsForImport);

        // Build full field values (defaults + imports)
        const fieldValues = {};
        fields.forEach((f) => {
          if (f.type === 'rich_text' && f.defaultText) {
            fieldValues[f.id] = f.defaultText;
          }
        });
        Object.assign(fieldValues, values);

        // Normalize dropdown/selector values to match available options
        // (e.g. "6-8" from markdown → "6–8" with en-dash from config)
        for (const field of fields) {
          const val = fieldValues[field.id];
          if (!val || typeof val !== 'string') continue;
          if (!['dropdown', 'grade_band_selector', 'theme_selector'].includes(field.type)) continue;
          if (!field.options || !Array.isArray(field.options)) continue;
          if (field.options.includes(val)) continue; // already exact match

          const normalize = (s) => s.replace(/[-\u2013\u2014]/g, '-').toLowerCase().trim();
          const match = field.options.find((opt) => normalize(opt) === normalize(val));
          if (match) {
            fieldValues[field.id] = match;
          }
        }

        const importedFieldIds = new Set(Object.keys(values));
        const importedFields = fields.filter((f) => importedFieldIds.has(f.id));
        const aiFields = fields.filter((f) => f.aiEnabled);

        // Fields that are required for generation but have no value yet
        const SKIP_TYPES = ['section_header', 'image', 'mcqs', 'vocabulary_words'];
        const missingRequiredFields = fields.filter((f) => {
          if (!f.requiredForGeneration) return false;
          if (f.aiEnabled) return false;
          if (SKIP_TYPES.includes(f.type)) return false;
          if (importedFieldIds.has(f.id)) return false;
          const val = fieldValues[f.id];
          if (!val) return true;
          if (typeof val === 'string' && !val.trim()) return true;
          if (typeof val === 'string' && val === '<p></p>') return true;
          if (Array.isArray(val) && val.length === 0) return true;
          return false;
        });

        reviews.push({
          fields,
          fieldValues,
          importedFieldIds,
          importedFields,
          missingRequiredFields,
          missingImportFields: missingFields,
          notFoundStandards,
          aiFields,
        });
      }

      setReviewData(reviews);
      // Expand all lessons by default
      setExpandedLessons(new Set(resolvedLessons.map((_, i) => i)));
      setStep('review');
    } catch (err) {
      console.error('Failed to load review data:', err);
    } finally {
      setLoadingReview(false);
    }
  };

  /* ─── Update a field value during review editing ─── */

  const updateFieldValue = (lessonIndex, fieldId, newValue) => {
    setReviewData((prev) => {
      const next = [...prev];
      next[lessonIndex] = {
        ...next[lessonIndex],
        fieldValues: {
          ...next[lessonIndex].fieldValues,
          [fieldId]: newValue,
        },
      };
      return next;
    });
  };

  /* ─── Toggle lesson accordion ─── */

  const toggleLesson = (index) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  /* ─── Check all required-for-generation fields are filled ─── */

  const SKIP_TYPES = ['section_header', 'image', 'mcqs', 'vocabulary_words'];

  const allRequiredFilled = step !== 'review' || reviewData.every((review) =>
    review.fields.every((field) => {
      if (!field.requiredForGeneration) return true;
      if (field.aiEnabled) return true;
      if (SKIP_TYPES.includes(field.type)) return true;
      const val = review.fieldValues[field.id];
      if (!val) return false;
      if (typeof val === 'string' && !val.trim()) return false;
      if (typeof val === 'string' && val === '<p></p>') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    })
  );

  /* ─── Start batch with reviewed values ─── */

  const handleStart = () => {
    if (step === 'review') {
      // Pass pre-imported values + fields so engine skips import
      onBatchStart({
        lessons: resolvedLessons.map((lesson, i) => ({
          ...lesson,
          fields: reviewData[i].fields,
          preImportedValues: reviewData[i].fieldValues,
        })),
        model: selectedModel,
      });
    } else {
      onBatchStart({
        lessons: resolvedLessons,
        model: selectedModel,
      });
    }
  };

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
          maxWidth: step === 'review' ? '900px' : '720px',
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
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
              {step === 'review' ? 'Review Imports' : 'Batch Create Lessons'}
            </h2>
            {step === 'review' && (
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0' }}>
                Review and edit imported values before generating AI content
              </p>
            )}
          </div>
          <button
            onClick={onClose}
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
          {step === 'upload' ? (
            /* ──────────────── UPLOAD STEP ──────────────── */
            <>
              {/* Instructions */}
              <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.6 }}>
                Upload a markdown file with up to 5 lessons separated by{' '}
                <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                  ---
                </code>
                . Each lesson must include a{' '}
                <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                  #Template Name
                </code>{' '}
                header matching an existing template.
              </p>

              {/* Drop zone */}
              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? '#3b82f6' : '#cbd5e1'}`,
                    borderRadius: '12px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragging ? '#eff6ff' : '#f8fafc',
                    transition: 'all 0.2s',
                    marginBottom: '1rem',
                  }}
                >
                  <Upload
                    size={32}
                    style={{ color: dragging ? '#3b82f6' : '#94a3b8', margin: '0 auto 0.75rem' }}
                  />
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', margin: 0 }}>
                    Drop a .md file here or click to browse
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Accepts .md and .txt files
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </div>
              ) : (
                <>
                  {/* File info */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    <FileText size={18} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#166534', flex: 1 }}>
                      {file.name}
                    </span>
                    <button
                      onClick={handleReset}
                      style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        background: 'none',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      Change File
                    </button>
                  </div>

                  {/* Parse errors */}
                  {parseResult?.errors?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      {parseResult.errors.map((err, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            background: '#fef2f2',
                            borderRadius: '6px',
                            marginBottom: '0.5rem',
                            border: '1px solid #fecaca',
                          }}
                        >
                          <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.8125rem', color: '#991b1b' }}>{err.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lesson cards */}
                  {resolvedLessons.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                        {resolvedLessons.length} lesson{resolvedLessons.length !== 1 ? 's' : ''} detected
                      </p>
                      {resolvedLessons.map((lesson, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            background: lesson.error ? '#fef2f2' : '#f0fdf4',
                            borderRadius: '8px',
                            marginBottom: '0.5rem',
                            border: `1px solid ${lesson.error ? '#fecaca' : '#bbf7d0'}`,
                          }}
                        >
                          {lesson.error ? (
                            <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                          ) : (
                            <CheckCircle size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: lesson.error ? '#991b1b' : '#166534',
                              }}
                            >
                              Lesson {idx + 1}: {lesson.templateName}
                            </div>
                            {lesson.error ? (
                              <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                                {lesson.error}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#15803d' }}>
                                {lesson.fieldCount} field{lesson.fieldCount !== 1 ? 's' : ''} imported
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Model selector */}
                  {resolvedLessons.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* ──────────────── REVIEW STEP ──────────────── */
            <>
              {resolvedLessons.map((lesson, lessonIdx) => {
                const review = reviewData[lessonIdx];
                if (!review) return null;
                const isExpanded = expandedLessons.has(lessonIdx);
                const importedCount = review.importedFields.length;
                const aiCount = review.aiFields.length;

                return (
                  <div
                    key={lessonIdx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      marginBottom: '1rem',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Lesson accordion header */}
                    <button
                      onClick={() => toggleLesson(lessonIdx)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.875rem 1rem',
                        background: '#f8fafc',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0 }} />
                      ) : (
                        <ChevronRight size={16} style={{ color: '#64748b', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', flex: 1 }}>
                        Lesson {lessonIdx + 1}: {lesson.templateName}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        {importedCount} imported, {aiCount} AI
                      </span>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
                        {/* Not-found standards warning */}
                        {review.notFoundStandards?.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              padding: '0.5rem 0.75rem',
                              background: '#fffbeb',
                              borderRadius: '6px',
                              marginBottom: '0.75rem',
                              border: '1px solid #fcd34d',
                            }}
                          >
                            <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ fontSize: '0.75rem', color: '#92400e' }}>
                              Standards not found: {review.notFoundStandards.join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Imported required-for-generation fields (editable) */}
                        {(() => {
                          const requiredImported = review.importedFields.filter(f => f.requiredForGeneration);
                          if (requiredImported.length === 0) return null;
                          return (
                            <div style={{ marginBottom: '0.75rem' }}>
                              {requiredImported.map((field) => (
                                <div key={field.id} style={{ marginBottom: '0.5rem' }}>
                                  <FieldRenderer
                                    field={{ ...field, aiEnabled: false, requiredForGeneration: false }}
                                    value={review.fieldValues[field.id]}
                                    onChange={(val) => updateFieldValue(lessonIdx, field.id, val)}
                                    hideRequiredAsterisk
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Required-for-generation fields that are missing */}
                        {review.missingRequiredFields.length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.5rem 0.75rem',
                                background: '#fef2f2',
                                borderRadius: '8px 8px 0 0',
                                border: '1px solid #fca5a5',
                                borderBottom: 'none',
                              }}
                            >
                              <AlertTriangle size={13} style={{ color: '#dc2626' }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b' }}>
                                Required for generation — please fill in before starting
                              </span>
                            </div>
                            <div
                              style={{
                                border: '1px solid #fca5a5',
                                borderRadius: '0 0 8px 8px',
                                padding: '0.75rem',
                                background: '#fff5f5',
                              }}
                            >
                              {review.missingRequiredFields.map((field) => (
                                <div key={field.id} style={{ marginBottom: '0.5rem' }}>
                                  <FieldRenderer
                                    field={{ ...field, aiEnabled: false }}
                                    value={review.fieldValues[field.id] || ''}
                                    onChange={(val) => updateFieldValue(lessonIdx, field.id, val)}
                                    isMissing
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* AI-generated fields summary */}
                        {review.aiFields.length > 0 && (
                          <div
                            style={{
                              padding: '0.625rem 0.75rem',
                              background: '#f0f9ff',
                              borderRadius: '8px',
                              border: '1px solid #bae6fd',
                              marginBottom: review.missingImportFields.length > 0 ? '0.5rem' : 0,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                marginBottom: '0.375rem',
                              }}
                            >
                              <Sparkles size={13} style={{ color: '#0284c7' }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0c4a6e' }}>
                                Will be AI-generated
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {review.aiFields.map((f) => (
                                <span
                                  key={f.id}
                                  style={{
                                    fontSize: '0.6875rem',
                                    background: '#e0f2fe',
                                    color: '#075985',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {f.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Missing importable fields (excluding those shown in required section) */}
                        {(() => {
                          const requiredNames = new Set(review.missingRequiredFields.map((f) => f.name));
                          const otherMissing = review.missingImportFields.filter((name) => !requiredNames.has(name));
                          if (otherMissing.length === 0) return null;
                          return (
                          <div
                            style={{
                              padding: '0.625rem 0.75rem',
                              background: '#fffbeb',
                              borderRadius: '8px',
                              border: '1px solid #fcd34d',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                marginBottom: '0.375rem',
                              }}
                            >
                              <AlertTriangle size={13} style={{ color: '#d97706' }} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e' }}>
                                Not in markdown
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {otherMissing.map((name, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '0.6875rem',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Model selector in review step */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  marginTop: '0.5rem',
                }}
              >
                <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
              </div>
            </>
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
          <div>
            {step === 'review' && (
              <button
                onClick={() => setStep('upload')}
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
                Back
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
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
              Cancel
            </button>
            {step === 'upload' ? (
              <button
                onClick={handleReviewImports}
                disabled={!allValid || loadingReview}
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#fff',
                  background: allValid && !loadingReview
                    ? 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)'
                    : '#d1d5db',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: allValid && !loadingReview ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
              >
                {loadingReview && (
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                )}
                Review Imports ({resolvedLessons.length} lesson{resolvedLessons.length !== 1 ? 's' : ''})
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!allRequiredFilled}
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#fff',
                  background: allRequiredFilled
                    ? 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)'
                    : '#d1d5db',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: allRequiredFilled ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                Start Batch Creation ({resolvedLessons.length} lesson{resolvedLessons.length !== 1 ? 's' : ''})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
