import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, FileText, Shield, Activity, RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * /tests — Dev dashboard showing test results + coverage from the last
 * `npm run test:report` run.  Data comes from two static JSON files
 * that vitest writes into public/.
 */
export default function TestDashboard() {
  const [results, setResults] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [resRes, covRes] = await Promise.all([
        fetch('/test-results.json'),
        fetch('/coverage/coverage-summary.json'),
      ]);
      if (!resRes.ok) throw new Error('No test results found. Run: npm run test:report');
      setResults(await resRes.json());
      if (covRes.ok) setCoverage(await covRes.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!results) return null;

  const { numTotalTests, numPassedTests, numFailedTests, numPendingTests,
    numTotalTestSuites, numPassedTestSuites, numFailedTestSuites,
    success, startTime, testResults } = results;

  const runDate = new Date(startTime);
  const totalDuration = testResults.reduce((sum, t) => sum + (t.endTime - t.startTime), 0);
  const coverageTotals = coverage?.total;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <Activity size={28} style={{ marginRight: 10, color: '#fff' }} />
            Test Dashboard
          </h1>
          <p style={styles.subtitle}>
            Last run: {runDate.toLocaleDateString()} at {runDate.toLocaleTimeString()}
            &nbsp;·&nbsp;{Math.round(totalDuration)}ms
          </p>
        </div>
        <div style={styles.headerRight}>
          <StatusBadge success={success} />
          <p style={styles.hint}>
            <RefreshCw size={13} style={{ marginRight: 4 }} />
            npm run test:report
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardGrid}>
        <SummaryCard icon={<FileText size={20} />} label="Test Suites" value={`${numPassedTestSuites}/${numTotalTestSuites}`} sub={numFailedTestSuites > 0 ? `${numFailedTestSuites} failed` : 'all passed'} color={numFailedTestSuites > 0 ? 'var(--danger)' : 'var(--success)'} />
        <SummaryCard icon={<CheckCircle size={20} />} label="Tests" value={`${numPassedTests}/${numTotalTests}`} sub={numFailedTests > 0 ? `${numFailedTests} failed` : numPendingTests > 0 ? `${numPendingTests} pending` : 'all passed'} color={numFailedTests > 0 ? 'var(--danger)' : 'var(--success)'} />
        {coverageTotals && (
          <>
            <SummaryCard icon={<Shield size={20} />} label="Line Coverage" value={`${coverageTotals.lines.pct.toFixed(1)}%`} sub={`${coverageTotals.lines.covered}/${coverageTotals.lines.total} lines`} color={pctColor(coverageTotals.lines.pct)} />
            <SummaryCard icon={<Shield size={20} />} label="Branch Coverage" value={`${coverageTotals.branches.pct.toFixed(1)}%`} sub={`${coverageTotals.branches.covered}/${coverageTotals.branches.total} branches`} color={pctColor(coverageTotals.branches.pct)} />
          </>
        )}
      </div>

      {/* Coverage breakdown by file */}
      {coverage && Object.keys(coverage).length > 1 && (
        <CoverageTable coverage={coverage} />
      )}

      {/* Test file results */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Test Files</h2>
        {testResults.map((suite) => (
          <TestSuiteRow key={suite.name} suite={suite} />
        ))}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function StatusBadge({ success }) {
  return (
    <span style={{
      ...styles.badge,
      background: success ? '#dcfce7' : '#fee2e2',
      color: success ? '#166534' : '#991b1b',
      border: `1px solid ${success ? '#86efac' : '#fca5a5'}`,
    }}>
      {success
        ? <><CheckCircle size={16} style={{ marginRight: 6 }} /> ALL PASSING</>
        : <><XCircle size={16} style={{ marginRight: 6 }} /> FAILURES</>}
    </span>
  );
}

function SummaryCard({ icon, label, value, sub, color }) {
  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--gray-500)' }}>
        {icon} <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function TestSuiteRow({ suite }) {
  const passed = suite.assertionResults.filter((t) => t.status === 'passed').length;
  const failed = suite.assertionResults.filter((t) => t.status === 'failed').length;
  const total = suite.assertionResults.length;
  const duration = Math.round(suite.endTime - suite.startTime);
  const shortName = suite.name.replace(/^.*?src\//, 'src/');

  return (
    <div style={{
      ...styles.suiteRow,
      borderLeft: `3px solid ${failed > 0 ? 'var(--danger)' : 'var(--success)'}`,
    }}>
      <div style={styles.suiteHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {failed > 0
            ? <XCircle size={16} color="var(--danger)" />
            : <CheckCircle size={16} color="var(--success)" />}
          <span style={{ fontWeight: 600, fontSize: '0.9rem', fontFamily: 'monospace' }}>{shortName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem', color: 'var(--gray-500)' }}>
          <span>{passed}/{total} passed</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={12} /> {duration}ms
          </span>
        </div>
      </div>
      <div style={styles.testList}>
        {suite.assertionResults.map((test, i) => (
          <div key={i} style={styles.testRow}>
            {test.status === 'passed'
              ? <CheckCircle size={13} color="var(--success)" />
              : <XCircle size={13} color="var(--danger)" />}
            <span style={{ fontSize: '0.8rem', color: test.status === 'passed' ? 'var(--gray-700)' : 'var(--danger)' }}>
              {test.ancestorTitles?.join(' › ')}{test.ancestorTitles?.length ? ' › ' : ''}{test.title}
            </span>
            {test.status === 'failed' && test.failureMessages?.length > 0 && (
              <pre style={styles.failureMsg}>{test.failureMessages[0].slice(0, 300)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageTable({ coverage }) {
  const files = Object.entries(coverage)
    .filter(([key]) => key !== 'total')
    .map(([path, data]) => ({
      name: path.replace(/^.*?src\//, 'src/'),
      lines: data.lines.pct,
      branches: data.branches.pct,
      functions: data.functions.pct,
      statements: data.statements.pct,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Coverage by File</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>File</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Lines</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Branches</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Functions</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Statements</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.name}>
                <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '0.8rem' }}>{f.name}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}><PctCell value={f.lines} /></td>
                <td style={{ ...styles.td, textAlign: 'right' }}><PctCell value={f.branches} /></td>
                <td style={{ ...styles.td, textAlign: 'right' }}><PctCell value={f.functions} /></td>
                <td style={{ ...styles.td, textAlign: 'right' }}><PctCell value={f.statements} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PctCell({ value }) {
  return (
    <span style={{ color: pctColor(value), fontWeight: 600, fontSize: '0.85rem' }}>
      {value.toFixed(1)}%
    </span>
  );
}

function LoadingState() {
  return (
    <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <RefreshCw size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={styles.container}>
      <div style={styles.errorBox}>
        <AlertTriangle size={24} color="#92400e" />
        <div>
          <h3 style={{ margin: 0, color: '#92400e' }}>No test data found</h3>
          <p style={{ margin: '8px 0 0', color: '#a16207', fontSize: '0.9rem' }}>{message}</p>
          <code style={{ display: 'block', marginTop: 12, padding: '8px 12px', background: '#fff', borderRadius: 6, fontSize: '0.85rem', color: '#1f2937' }}>
            npm run test:report
          </code>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function pctColor(pct) {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

/* ── Styles ──────────────────────────────────────────── */

const styles = {
  container: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#ffffffcc',
    marginTop: 4,
  },
  hint: {
    fontSize: '0.75rem',
    color: '#ffffff99',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'monospace',
    margin: 0,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid var(--gray-100)',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--gray-800)',
    marginBottom: '1rem',
    paddingBottom: 8,
    borderBottom: '2px solid var(--gray-100)',
  },
  suiteRow: {
    background: '#fff',
    borderRadius: 10,
    marginBottom: '0.75rem',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    border: '1px solid var(--gray-100)',
  },
  suiteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    background: 'var(--gray-50)',
    flexWrap: 'wrap',
    gap: 8,
  },
  testList: {
    padding: '0.5rem 1rem',
  },
  testRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
  },
  failureMsg: {
    margin: '4px 0 4px 24px',
    padding: '8px',
    background: '#fef2f2',
    borderRadius: 6,
    fontSize: '0.75rem',
    color: '#991b1b',
    whiteSpace: 'pre-wrap',
    overflow: 'auto',
    maxHeight: 120,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  th: {
    padding: '10px 12px',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--gray-500)',
    background: 'var(--gray-50)',
    borderBottom: '1px solid var(--gray-200)',
    textAlign: 'left',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--gray-100)',
  },
  errorBox: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    padding: '1.5rem',
    background: '#fffbeb',
    border: '1px solid #fbbf24',
    borderRadius: 12,
    marginTop: '2rem',
  },
};
