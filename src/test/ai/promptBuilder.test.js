/**
 * Tests for buildFullPrompt() — the core prompt assembly function.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { buildFullPrompt } from '../../ai/promptBuilder';

describe('buildFullPrompt', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('returns empty-ish prompt when given no config', () => {
    const result = buildFullPrompt({});
    // Should still include FORMAT REQUIREMENTS section (always present)
    expect(result).toContain('=== FORMAT REQUIREMENTS ===');
    expect(result).toContain('No specific format requirements.');
  });

  it('includes all four sections when fully configured', () => {
    const result = buildFullPrompt({
      systemInstructions: 'You are a teacher.',
      prompt: 'Write a vocabulary exercise.',
      formatRequirements: 'Use bullet points.',
      contextInstructions: 'Refer to the passage below.',
      selectedFieldIds: ['f1'],
      allFields: [{ id: 'f1', name: 'Passage' }],
      fieldValues: { f1: 'The quick brown fox.' },
    });

    expect(result).toContain('=== SYSTEM INSTRUCTIONS ===');
    expect(result).toContain('You are a teacher.');
    expect(result).toContain('=== TASK ===');
    expect(result).toContain('Write a vocabulary exercise.');
    expect(result).toContain('=== FORMAT REQUIREMENTS ===');
    expect(result).toContain('Use bullet points.');
    expect(result).toContain('=== CONTEXT ===');
    expect(result).toContain('Refer to the passage below.');
    expect(result).toContain('Passage: The quick brown fox.');
  });

  it('omits SYSTEM INSTRUCTIONS section when empty', () => {
    const result = buildFullPrompt({
      prompt: 'Do something.',
    });
    expect(result).not.toContain('=== SYSTEM INSTRUCTIONS ===');
    expect(result).toContain('=== TASK ===');
  });

  it('omits CONTEXT section when no fields selected and no extra blocks', () => {
    const result = buildFullPrompt({
      prompt: 'Hello',
      selectedFieldIds: [],
      extraContextBlocks: [],
    });
    expect(result).not.toContain('=== CONTEXT ===');
  });

  it('shows [Not filled] for missing field values', () => {
    const result = buildFullPrompt({
      prompt: 'Generate.',
      selectedFieldIds: ['f1'],
      allFields: [{ id: 'f1', name: 'Title' }],
      fieldValues: {},
    });
    expect(result).toContain('Title: [Not filled]');
  });

  it('stringifies object field values as JSON', () => {
    const result = buildFullPrompt({
      selectedFieldIds: ['f1'],
      allFields: [{ id: 'f1', name: 'MCQs' }],
      fieldValues: { f1: { questions: [{ q: 'What?', a: 'This' }] } },
    });
    // MCQ fields with questions array should be cleaned (only questions key)
    expect(result).toContain('"questions"');
    expect(result).toContain('What?');
  });

  it('strips metadata from MCQ field values', () => {
    const mcqValue = {
      questions: [{ q: 'Q1' }],
      sourceStandards: ['CCSS.1'],
      filteredOutStandards: ['CCSS.2'],
      standards: ['CCSS.1'],
    };
    const result = buildFullPrompt({
      selectedFieldIds: ['f1'],
      allFields: [{ id: 'f1', name: 'MCQs' }],
      fieldValues: { f1: mcqValue },
    });
    expect(result).toContain('"questions"');
    expect(result).not.toContain('sourceStandards');
    expect(result).not.toContain('filteredOutStandards');
  });

  it('includes extra context blocks', () => {
    const result = buildFullPrompt({
      selectedFieldIds: [],
      extraContextBlocks: [
        { title: 'Standards', content: 'CCSS.RL.5.1' },
        { title: 'Theme', content: 'Adventure' },
      ],
    });
    expect(result).toContain('=== CONTEXT ===');
    expect(result).toContain('Standards:\nCCSS.RL.5.1');
    expect(result).toContain('Theme:\nAdventure');
  });

  it('skips malformed extra context blocks', () => {
    const result = buildFullPrompt({
      selectedFieldIds: [],
      extraContextBlocks: [null, {}, { title: 'Only title' }, { content: 'Only content' }],
    });
    // Should have CONTEXT header but none of the broken blocks rendered
    expect(result).toContain('=== CONTEXT ===');
    expect(result).not.toContain('Only title');
    expect(result).not.toContain('Only content');
  });

  it('converts HTML to plain text in system instructions', () => {
    const result = buildFullPrompt({
      systemInstructions: '<p>Be <strong>concise</strong>.</p>',
    });
    expect(result).toContain('Be concise.');
    // Structural wrapper tags should be stripped
    expect(result).not.toContain('</p>');
    expect(result).not.toContain('<strong>');
  });

  it('preserves entity-encoded HTML tag names in format requirements', () => {
    const result = buildFullPrompt({
      formatRequirements: '<p>Return HTML using tags like &lt;p&gt;, &lt;h2&gt;, &lt;strong&gt; as appropriate. Do not include &lt;html&gt; or &lt;body&gt; tags.</p>',
    });
    expect(result).toContain('<p>');
    expect(result).toContain('<h2>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<html>');
    expect(result).toContain('<body>');
    expect(result).toContain('Return HTML using tags like');
  });

  it('skips context fields that are not in allFields', () => {
    const result = buildFullPrompt({
      selectedFieldIds: ['f1', 'f-nonexistent'],
      allFields: [{ id: 'f1', name: 'Title' }],
      fieldValues: { f1: 'Hello', 'f-nonexistent': 'Ghost' },
    });
    expect(result).toContain('Title: Hello');
    expect(result).not.toContain('Ghost');
  });

  it('always includes FORMAT REQUIREMENTS even with default text', () => {
    const result = buildFullPrompt({ prompt: 'Test' });
    expect(result).toContain('=== FORMAT REQUIREMENTS ===');
    expect(result).toContain('No specific format requirements.');
  });
});
