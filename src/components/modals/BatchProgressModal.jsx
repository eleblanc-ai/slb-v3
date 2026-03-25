import { useState, useEffect, useRef } from 'react';
import { X, Loader, CheckCircle, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { processLesson, mapDatabaseFields } from '../../services/batchLessonEngine';

const STATUS_CONFIG = {
  waiting: { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', label: 'Waiting' },
  in_progress: { color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', label: 'In Progress' },
  complete: { color: '#16a34a', bg: '#f0fdf4', border: '#86efac', label: 'Complete' },
  partial: { color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: 'Partial' },
  error: { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'Error' },
};

export default function BatchProgressModal({
  visible,
  batchConfig,
  session,
  onClose,
}) {
  const [lessonStatuses, setLessonStatuses] = useState([]);
  const [batchComplete, setBatchComplete] = useState(false);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(-1);
  const cancelledRef = useRef(false);

  // Initialize lesson statuses when modal opens
  useEffect(() => {
    if (!visible || !batchConfig?.lessons) return;
    cancelledRef.current = false;
    setBatchComplete(false);
    setCurrentLessonIndex(-1);
    setLessonStatuses(
      batchConfig.lessons.map((l) => ({
        status: 'waiting',
        progress: null,
        result: null,
        templateName: l.templateName,
      }))
    );
  }, [visible, batchConfig]);

  // Run batch processing
  useEffect(() => {
    if (!visible || !batchConfig?.lessons || lessonStatuses.length === 0) return;
    // Only start once (when all are 'waiting')
    if (!lessonStatuses.every((s) => s.status === 'waiting')) return;

    let active = true;

    async function runBatch() {
      const lessons = batchConfig.lessons;

      for (let i = 0; i < lessons.length; i++) {
        if (cancelledRef.current || !active) break;

        const lessonConfig = lessons[i];
        setCurrentLessonIndex(i);

        // Mark in progress
        setLessonStatuses((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'in_progress', progress: { message: 'Starting...' } };
          return next;
        });

        try {
          // Use pre-fetched fields from review, or fetch from DB
          let mappedFields;
          if (lessonConfig.fields) {
            mappedFields = lessonConfig.fields;
          } else {
            const { data: fieldsData, error: fieldsError } = await supabase
              .from('lesson_template_fields')
              .select('*')
              .eq('lesson_template_id', lessonConfig.template.id)
              .order('field_order', { ascending: true });

            if (fieldsError) throw new Error(`Failed to load fields: ${fieldsError.message}`);
            mappedFields = mapDatabaseFields(fieldsData);
          }

          // Process the lesson
          const result = await processLesson({
            template: lessonConfig.template,
            fields: mappedFields,
            parsedFields: lessonConfig.parsedFields,
            preImportedValues: lessonConfig.preImportedValues || null,
            userId: session.user.id,
            model: batchConfig.model,
            onProgress: (update) => {
              if (!active) return;
              setLessonStatuses((prev) => {
                const next = [...prev];
                next[i] = {
                  ...next[i],
                  progress: { ...next[i].progress, ...update },
                };
                return next;
              });
            },
            supabaseClient: supabase,
          });

          // Mark complete or partial
          const finalStatus = result.errors.length > 0 ? 'partial' : 'complete';
          setLessonStatuses((prev) => {
            const next = [...prev];
            next[i] = {
              ...next[i],
              status: finalStatus,
              result,
              progress: {
                ...next[i].progress,
                message: finalStatus === 'complete' ? 'Done!' : `Done with ${result.errors.length} error(s)`,
              },
            };
            return next;
          });
        } catch (err) {
          console.error(`❌ Batch lesson ${i + 1} failed:`, err);
          setLessonStatuses((prev) => {
            const next = [...prev];
            next[i] = {
              ...next[i],
              status: 'error',
              progress: { ...next[i].progress, message: err.message },
              result: { lessonId: null, errors: [err.message] },
            };
            return next;
          });
        }
      }

      if (active) setBatchComplete(true);
    }

    runBatch();
    return () => {
      active = false;
    };
  }, [visible, batchConfig, session, lessonStatuses.length]);

  const handleCancel = () => {
    cancelledRef.current = true;
    setBatchComplete(true);
  };

  const completedCount = lessonStatuses.filter(
    (s) => s.status === 'complete' || s.status === 'partial'
  ).length;

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
        zIndex: 1001,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          maxWidth: '780px',
          width: '100%',
          maxHeight: '85vh',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
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
              Batch Progress
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.25rem 0 0' }}>
              {batchComplete
                ? `${completedCount} of ${lessonStatuses.length} lessons processed`
                : currentLessonIndex >= 0
                  ? `Processing lesson ${currentLessonIndex + 1} of ${lessonStatuses.length}...`
                  : 'Starting...'}
            </p>
          </div>
          {batchComplete && (
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
          )}
        </div>

        {/* Overall progress bar */}
        <div style={{ padding: '0 1.5rem', paddingTop: '1rem' }}>
          <div
            style={{
              height: '6px',
              background: '#e2e8f0',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${lessonStatuses.length > 0 ? (completedCount / lessonStatuses.length) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #10b981, #3b82f6)',
                borderRadius: '3px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>

        {/* Lesson cards */}
        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {lessonStatuses.map((ls, idx) => {
            const cfg = STATUS_CONFIG[ls.status];
            return (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderRadius: '10px',
                  marginBottom: '0.75rem',
                }}
              >
                {/* Card header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: ls.status === 'waiting' ? 0 : '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StatusIcon status={ls.status} />
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: cfg.color,
                      }}
                    >
                      Lesson {idx + 1}: {ls.templateName}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: cfg.color,
                      background: '#fff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${cfg.border}`,
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Progress detail */}
                {ls.status !== 'waiting' && ls.progress && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: '#475569',
                        margin: 0,
                        marginBottom: '0.375rem',
                      }}
                    >
                      {ls.progress.message}
                    </p>

                    {/* Field progress bar */}
                    {ls.progress.totalFields > 0 && ls.status === 'in_progress' && (
                      <div
                        style={{
                          height: '4px',
                          background: '#e2e8f0',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${((ls.progress.fieldIndex + 1) / ls.progress.totalFields) * 100}%`,
                            background: '#3b82f6',
                            borderRadius: '2px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    )}

                    {/* Cover image thumbnail */}
                    {ls.progress.imageUrl && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <img
                          src={ls.progress.imageUrl}
                          alt="Generated cover"
                          style={{
                            width: '120px',
                            height: '80px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                          }}
                        />
                      </div>
                    )}

                    {/* Missing fields */}
                    {ls.progress.missingFields?.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          marginTop: '0.375rem',
                        }}
                      >
                        {ls.progress.missingFields.map((mf, mIdx) => (
                          <span
                            key={mIdx}
                            style={{
                              fontSize: '0.6875rem',
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #fcd34d',
                            }}
                          >
                            Missing: {mf}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Errors */}
                    {ls.result?.errors?.length > 0 && (
                      <div style={{ marginTop: '0.375rem' }}>
                        {ls.result.errors.map((err, eIdx) => (
                          <p
                            key={eIdx}
                            style={{
                              fontSize: '0.75rem',
                              color: '#dc2626',
                              margin: '0.125rem 0',
                            }}
                          >
                            {err}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Lesson link when complete */}
                    {ls.result?.lessonId && (ls.status === 'complete' || ls.status === 'partial') && (
                      <a
                        href={`/create-new-lesson?templateId=${batchConfig.lessons[idx].template.id}&lessonId=${ls.result.lessonId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          color: '#2563eb',
                          marginTop: '0.5rem',
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={12} />
                        Open in Lesson Editor
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          {batchComplete ? (
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#fff',
                background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          ) : (
            <button
              onClick={handleCancel}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#dc2626',
                background: '#fff',
                border: '2px solid #fca5a5',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel After Current Lesson
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  switch (status) {
    case 'waiting':
      return <Clock size={16} style={{ color: '#94a3b8' }} />;
    case 'in_progress':
      return (
        <Loader
          size={16}
          style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }}
        />
      );
    case 'complete':
      return <CheckCircle size={16} style={{ color: '#16a34a' }} />;
    case 'partial':
      return <AlertTriangle size={16} style={{ color: '#d97706' }} />;
    case 'error':
      return <AlertTriangle size={16} style={{ color: '#dc2626' }} />;
    default:
      return null;
  }
}
