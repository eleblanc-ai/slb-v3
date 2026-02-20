/**
 * Tests for standardsMapper.js — sync + async functions.
 * Async functions that load CSV are tested by mocking global fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Static import for sync-only functions (module-level cache won't matter for these)
import { extractGradeFromBand, extractGradesFromBand, insertStandardInOrder } from '../../lib/standardsMapper';

// ─── Synthetic CSV used by async tests ───────────────────────────────
const MOCK_CSV = [
  'CCSS Code,CCSS Standard,Mapped Framework,Mapped Code,Mapped Standard',
  'CCSS.L.8.4,Determine meaning of words,TEKS,TEKS.ELAR.8.2(B),Determine meaning using context',
  'CCSS.L.8.6,Acquire vocabulary,BEST,BEST.ELA.8.V.1.1,Use context clues',
  'CCSS.L.8.6,Acquire vocabulary,GSE,8.L.V.1,Use context clues GSE',
  'CCSS.L.9-10.4,Determine meaning of words HS,TEKS,TEKS.ELAR.E1.2(B),Determine meaning HS',
  'CCSS.L.9-10.6,Acquire vocabulary HS,BEST,BEST.ELA.9.V.1.1,Use context clues HS',
  'CCSS.RI.8.2,Determine central idea,TEKS,TEKS.ELAR.8.6(A),Summarize central idea',
  'CCSS.RI.8.2,Determine central idea,BEST,BEST.ELA.8.R.2.2,Explain central idea',
  'CCSS.RI.8.2,Determine central idea,GSE,8.T.RA.2,Central idea GSE',
  'CCSS.RI.9-10.2,Determine central idea HS,TEKS,TEKS.ELAR.E1.6(A),Summarize HS',
  'CCSS.RI.9-10.2,Determine central idea HS,BEST,BEST.ELA.9.R.2.2,Central idea HS BEST',
].join('\n');

function mockFetchCSV() {
  global.fetch = vi.fn().mockResolvedValue({
    text: () => Promise.resolve(MOCK_CSV),
  });
}

// ─── SYNC: extractGradeFromBand ──────────────────────────────────────
describe('extractGradeFromBand', () => {
  it('returns highest grade from a range with en-dash', () => {
    expect(extractGradeFromBand('9–10')).toBe(10);
  });

  it('returns highest grade from a range with hyphen', () => {
    expect(extractGradeFromBand('11-12')).toBe(12);
  });

  it('returns the grade for a single number', () => {
    expect(extractGradeFromBand('8')).toBe(8);
  });

  it('returns null for null input', () => {
    expect(extractGradeFromBand(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(extractGradeFromBand(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractGradeFromBand('')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(extractGradeFromBand('kindergarten')).toBeNull();
  });
});

// ─── SYNC: extractGradesFromBand (plural — returns array) ───────────
describe('extractGradesFromBand', () => {
  it('returns all grades from a range with en-dash', () => {
    expect(extractGradesFromBand('9–10')).toEqual([9, 10]);
  });

  it('returns all grades from a range with hyphen', () => {
    expect(extractGradesFromBand('11-12')).toEqual([11, 12]);
  });

  it('returns single-element array for a single number', () => {
    expect(extractGradesFromBand('8')).toEqual([8]);
  });

  it('returns empty array for null input', () => {
    expect(extractGradesFromBand(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(extractGradesFromBand(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractGradesFromBand('')).toEqual([]);
  });

  it('returns empty array for non-numeric string', () => {
    expect(extractGradesFromBand('kindergarten')).toEqual([]);
  });
});

// ─── SYNC: insertStandardInOrder ─────────────────────────────────────
describe('insertStandardInOrder', () => {
  it('inserts a standard into an empty string', () => {
    expect(insertStandardInOrder('', 'CCSS.RL.5.1')).toBe('CCSS.RL.5.1');
  });

  it('inserts a standard into a null string', () => {
    expect(insertStandardInOrder(null, 'TEKS.ELAR.3.1')).toBe('TEKS.ELAR.3.1');
  });

  it('returns existing string when standardToInsert is empty', () => {
    expect(insertStandardInOrder('CCSS.RL.5.1', '')).toBe('CCSS.RL.5.1');
  });

  it('does not duplicate an already-present standard', () => {
    const existing = 'CCSS.RL.5.1; TEKS.ELAR.3.1';
    expect(insertStandardInOrder(existing, 'CCSS.RL.5.1')).toBe(existing);
  });

  it('maintains framework ordering: CCSS, TEKS, BEST, BLOOM, GSE', () => {
    const result = insertStandardInOrder('CCSS.RL.5.1', 'TEKS.ELAR.3.1');
    expect(result).toBe('CCSS.RL.5.1; TEKS.ELAR.3.1');
  });

  it('inserts CCSS before TEKS', () => {
    const result = insertStandardInOrder('TEKS.ELAR.3.1', 'CCSS.RL.5.1');
    expect(result).toBe('CCSS.RL.5.1; TEKS.ELAR.3.1');
  });

  it('maintains order with all five frameworks', () => {
    let standards = 'CCSS.RL.5.1';
    standards = insertStandardInOrder(standards, 'BLOOM.4.2');
    standards = insertStandardInOrder(standards, 'TEKS.ELAR.3.1');
    standards = insertStandardInOrder(standards, 'BEST.ELA.5.R.1');
    standards = insertStandardInOrder(standards, '5.L.V.1');

    expect(standards).toBe('CCSS.RL.5.1; TEKS.ELAR.3.1; BEST.ELA.5.R.1; BLOOM.4.2; 5.L.V.1');
  });

  it('groups multiple standards of the same framework together', () => {
    let standards = 'CCSS.RL.5.1; TEKS.ELAR.3.1';
    standards = insertStandardInOrder(standards, 'CCSS.RL.5.2');
    const parts = standards.split('; ');
    const ccssIdx0 = parts.findIndex((s) => s === 'CCSS.RL.5.1');
    const ccssIdx1 = parts.findIndex((s) => s === 'CCSS.RL.5.2');
    const teksIdx = parts.findIndex((s) => s === 'TEKS.ELAR.3.1');
    expect(ccssIdx0).toBeLessThan(teksIdx);
    expect(ccssIdx1).toBeLessThan(teksIdx);
  });
});

// ─── ASYNC: getCcssVocabularyStandardsForGrade ───────────────────────
describe('getCcssVocabularyStandardsForGrade', () => {
  let getCcssVocabularyStandardsForGrade;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchCSV();
    const mod = await import('../../lib/standardsMapper');
    getCcssVocabularyStandardsForGrade = mod.getCcssVocabularyStandardsForGrade;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array for null grade', async () => {
    expect(await getCcssVocabularyStandardsForGrade(null)).toEqual([]);
  });

  it('returns empty array for undefined grade', async () => {
    expect(await getCcssVocabularyStandardsForGrade(undefined)).toEqual([]);
  });

  it('returns empty array for NaN grade', async () => {
    expect(await getCcssVocabularyStandardsForGrade('abc')).toEqual([]);
  });

  it('returns exact CCSS L.x.4 and L.x.6 codes for grade 8', async () => {
    const result = await getCcssVocabularyStandardsForGrade(8);
    expect(result).toContain('CCSS.L.8.4');
    expect(result).toContain('CCSS.L.8.6');
  });

  it('accepts grade as string', async () => {
    const result = await getCcssVocabularyStandardsForGrade('8');
    expect(result).toContain('CCSS.L.8.4');
  });

  it('falls back to range codes when no exact match exists', async () => {
    const result = await getCcssVocabularyStandardsForGrade(9);
    expect(result.some(c => c.includes('9-10'))).toBe(true);
  });
});

// ─── ASYNC: getMappedVocabularyStandardsForGrade ─────────────────────
describe('getMappedVocabularyStandardsForGrade', () => {
  let getMappedVocabularyStandardsForGrade;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchCSV();
    const mod = await import('../../lib/standardsMapper');
    getMappedVocabularyStandardsForGrade = mod.getMappedVocabularyStandardsForGrade;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty for CCSS framework (no mapping needed)', async () => {
    expect(await getMappedVocabularyStandardsForGrade(8, 'CCSS')).toEqual([]);
  });

  it('returns empty for null framework', async () => {
    expect(await getMappedVocabularyStandardsForGrade(8, null)).toEqual([]);
  });

  it('returns empty for null grade', async () => {
    expect(await getMappedVocabularyStandardsForGrade(null, 'TEKS')).toEqual([]);
  });

  it('returns empty for NaN grade', async () => {
    expect(await getMappedVocabularyStandardsForGrade('abc', 'TEKS')).toEqual([]);
  });

  it('returns TEKS vocab codes for grade 8', async () => {
    const result = await getMappedVocabularyStandardsForGrade(8, 'TEKS');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(c => c.startsWith('TEKS.'))).toBe(true);
  });

  it('returns GSE vocab codes for grade 8', async () => {
    const result = await getMappedVocabularyStandardsForGrade(8, 'GSE');
    expect(result.length).toBeGreaterThan(0);
  });

  it('is case-insensitive for framework', async () => {
    const result = await getMappedVocabularyStandardsForGrade(8, 'teks');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── ASYNC: getCcssMainIdeaStandardsForGrade ─────────────────────────
describe('getCcssMainIdeaStandardsForGrade', () => {
  let getCcssMainIdeaStandardsForGrade;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchCSV();
    const mod = await import('../../lib/standardsMapper');
    getCcssMainIdeaStandardsForGrade = mod.getCcssMainIdeaStandardsForGrade;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty for null grade', async () => {
    expect(await getCcssMainIdeaStandardsForGrade(null)).toEqual([]);
  });

  it('returns empty for NaN grade', async () => {
    expect(await getCcssMainIdeaStandardsForGrade('abc')).toEqual([]);
  });

  it('returns exact CCSS.RI.x.2 for grade 8', async () => {
    const result = await getCcssMainIdeaStandardsForGrade(8);
    expect(result).toEqual(['CCSS.RI.8.2']);
  });

  it('falls back to range when no exact match', async () => {
    const result = await getCcssMainIdeaStandardsForGrade(9);
    expect(result.some(c => c.includes('9-10'))).toBe(true);
  });
});

// ─── ASYNC: getMappedMainIdeaStandardsForGrade ───────────────────────
describe('getMappedMainIdeaStandardsForGrade', () => {
  let getMappedMainIdeaStandardsForGrade;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchCSV();
    const mod = await import('../../lib/standardsMapper');
    getMappedMainIdeaStandardsForGrade = mod.getMappedMainIdeaStandardsForGrade;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty for CCSS framework', async () => {
    expect(await getMappedMainIdeaStandardsForGrade(8, 'CCSS')).toEqual([]);
  });

  it('returns empty for null framework', async () => {
    expect(await getMappedMainIdeaStandardsForGrade(8, null)).toEqual([]);
  });

  it('returns empty for null grade', async () => {
    expect(await getMappedMainIdeaStandardsForGrade(null, 'TEKS')).toEqual([]);
  });

  it('returns empty for NaN grade', async () => {
    expect(await getMappedMainIdeaStandardsForGrade('abc', 'TEKS')).toEqual([]);
  });

  it('returns TEKS main idea codes for grade 8', async () => {
    const result = await getMappedMainIdeaStandardsForGrade(8, 'TEKS');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(c => c.startsWith('TEKS.'))).toBe(true);
  });

  it('returns BEST main idea codes for grade 8', async () => {
    const result = await getMappedMainIdeaStandardsForGrade(8, 'BEST');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── ASYNC: getMappedStandardsWithSource ─────────────────────────────
describe('getMappedStandardsWithSource', () => {
  let getMappedStandardsWithSource;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchCSV();
    const mod = await import('../../lib/standardsMapper');
    getMappedStandardsWithSource = mod.getMappedStandardsWithSource;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mapped standards and source for a CCSS code', async () => {
    const result = await getMappedStandardsWithSource('CCSS.RI.8.2');
    expect(result.sourceStandard.code).toBe('CCSS.RI.8.2');
    expect(result.sourceStandard.statement).toBe('Determine central idea');
    expect(result.mappedStandards).toContain('CCSS.RI.8.2');
  });

  it('returns mapped standards from a non-CCSS code via reverse lookup', async () => {
    const result = await getMappedStandardsWithSource('TEKS.ELAR.8.6(A)');
    expect(result.sourceStandard.code).toBe('TEKS.ELAR.8.6(A)');
    expect(result.mappedStandards).toContain('CCSS.RI.8.2');
  });

  it('returns "(Statement not available)" for unknown code', async () => {
    const result = await getMappedStandardsWithSource('FAKE.CODE.1');
    expect(result.sourceStandard.statement).toBe('(Statement not available)');
  });

  it('applies grade filter', async () => {
    const result = await getMappedStandardsWithSource('CCSS.RI.8.2', 8);
    expect(result.sourceStandard.code).toBe('CCSS.RI.8.2');
    expect(result.mappedStandards.length).toBeGreaterThan(0);
  });
});

// ─── ASYNC: filterAlignedStandardsWithAI ─────────────────────────────
describe('filterAlignedStandardsWithAI', () => {
  let filterAlignedStandardsWithAI;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchCSV();
    const mod = await import('../../lib/standardsMapper');
    filterAlignedStandardsWithAI = mod.filterAlignedStandardsWithAI;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns AI-filtered standards and backfills missing frameworks', async () => {
    const candidates = ['CCSS.RI.8.2', 'TEKS.ELAR.8.6(A)', 'BEST.ELA.8.R.2.2'];
    const mockAI = vi.fn().mockResolvedValue('CCSS.RI.8.2; TEKS.ELAR.8.6(A)');

    const result = await filterAlignedStandardsWithAI(
      'What is the main idea?',
      'Passage about dolphins',
      candidates,
      mockAI,
      'claude-sonnet-4-20250514'
    );

    expect(result).toContain('CCSS.RI.8.2');
    expect(result).toContain('TEKS.ELAR.8.6(A)');
    // BEST was not in AI response but should be backfilled (one per framework)
    expect(result).toContain('BEST.ELA.8.R.2.2');
  });

  it('falls back to one-per-framework when AI returns irrelevant text', async () => {
    const candidates = ['CCSS.RI.8.2', 'TEKS.ELAR.8.6(A)'];
    const mockAI = vi.fn().mockResolvedValue('nothing relevant');

    const result = await filterAlignedStandardsWithAI(
      'Question',
      'Context',
      candidates,
      mockAI,
      'gpt-4o'
    );

    expect(result).toContain('CCSS.RI.8.2');
    expect(result).toContain('TEKS.ELAR.8.6(A)');
  });

  it('returns original list when AI throws', async () => {
    const candidates = ['CCSS.RI.8.2', 'BEST.ELA.8.R.2.2'];
    const mockAI = vi.fn().mockRejectedValue(new Error('API down'));

    const result = await filterAlignedStandardsWithAI(
      'Question',
      'Context',
      candidates,
      mockAI,
      'gpt-4o'
    );

    expect(result).toEqual(candidates);
  });

  it('handles empty context gracefully', async () => {
    const candidates = ['CCSS.RI.8.2'];
    const mockAI = vi.fn().mockResolvedValue('CCSS.RI.8.2');

    const result = await filterAlignedStandardsWithAI(
      'Question',
      '',
      candidates,
      mockAI,
      'gpt-4o'
    );

    expect(result).toContain('CCSS.RI.8.2');
    const promptArg = mockAI.mock.calls[0][0];
    expect(promptArg).toContain('(No reading passage provided)');
  });
});
