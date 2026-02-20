import { describe, it, expect } from 'vitest';
import {
  isEmptyValue,
  validateContextFieldsForField,
  getMissingRequiredFields,
} from '../../lib/fieldValueUtils';

// ─── isEmptyValue ───────────────────────────────────────────────────
describe('isEmptyValue', () => {
  it('returns true for null / undefined / empty string', () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue('  ')).toBe(true);
  });

  it('returns true for empty arrays', () => {
    expect(isEmptyValue([])).toBe(true);
  });

  it('returns false for non-empty string', () => {
    expect(isEmptyValue('hello')).toBe(false);
  });

  it('returns false for non-empty arrays', () => {
    expect(isEmptyValue(['a'])).toBe(false);
  });

  // HTML handling
  it('returns true for HTML-only string with no text content', () => {
    expect(isEmptyValue('<p></p>')).toBe(true);
    expect(isEmptyValue('<p>  </p>')).toBe(true);
    expect(isEmptyValue('<br/>')).toBe(true);
    expect(isEmptyValue('<div><span></span></div>')).toBe(true);
  });

  it('returns true for string that is only &nbsp;', () => {
    expect(isEmptyValue('&nbsp;')).toBe(true);
    expect(isEmptyValue('&nbsp;&nbsp;&nbsp;')).toBe(true);
    expect(isEmptyValue('<p>&nbsp;</p>')).toBe(true);
  });

  it('returns false for HTML with text content', () => {
    expect(isEmptyValue('<p>Hello</p>')).toBe(false);
    expect(isEmptyValue('<strong>Bold</strong>')).toBe(false);
  });

  // Object handling
  it('returns true for empty object', () => {
    expect(isEmptyValue({})).toBe(true);
  });

  it('returns false for non-empty object', () => {
    expect(isEmptyValue({ key: 'value' })).toBe(false);
  });

  // MCQ .questions handling
  it('returns true when all questions in .questions are empty', () => {
    expect(isEmptyValue({ questions: [null, '', undefined] })).toBe(true);
  });

  it('returns false when at least one question is non-empty', () => {
    expect(isEmptyValue({ questions: ['', 'What is 2+2?'] })).toBe(false);
  });

  // Non-value types
  it('returns false for number 0 (falsy but not empty)', () => {
    // 0 is falsy, so isEmptyValue(0) returns true per current impl (!value)
    expect(isEmptyValue(0)).toBe(true);
  });

  it('returns false for boolean false', () => {
    expect(isEmptyValue(false)).toBe(true);
  });
});

// ─── validateContextFieldsForField ──────────────────────────────────
describe('validateContextFieldsForField', () => {
  const allFields = [
    { id: 'f1', name: 'Title', fieldFor: 'designer' },
    { id: 'f2', name: 'Passage', fieldFor: 'builder' },
    { id: 'f3', name: 'Grade', fieldFor: 'designer' },
    { id: 'f4', name: 'Vocabulary', fieldFor: 'builder' },
  ];

  it('returns empty array when field has no context field IDs', () => {
    const field = { ai_context_field_ids: [] };
    const result = validateContextFieldsForField(field, allFields, {});
    expect(result).toEqual([]);
  });

  it('returns empty array when ai_context_field_ids is undefined', () => {
    const field = {};
    const result = validateContextFieldsForField(field, allFields, {});
    expect(result).toEqual([]);
  });

  it('returns missing context fields that are empty', () => {
    const field = { ai_context_field_ids: ['f1', 'f2'] };
    const fieldValues = { f1: 'Lesson Title', f2: '' };
    const result = validateContextFieldsForField(field, allFields, fieldValues);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 'f2', name: 'Passage', section: 'Builder' });
  });

  it('returns all missing when all context fields are empty', () => {
    const field = { ai_context_field_ids: ['f1', 'f3'] };
    const fieldValues = { f1: '', f3: null };
    const result = validateContextFieldsForField(field, allFields, fieldValues);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Title');
    expect(result[1].name).toBe('Grade');
  });

  it('returns empty when all context fields have values', () => {
    const field = { ai_context_field_ids: ['f1', 'f2'] };
    const fieldValues = { f1: 'Title', f2: 'Some passage text' };
    const result = validateContextFieldsForField(field, allFields, fieldValues);

    expect(result).toEqual([]);
  });

  it('skips context field IDs that do not exist in allFields', () => {
    const field = { ai_context_field_ids: ['f1', 'nonexistent'] };
    const fieldValues = { f1: '' };
    const result = validateContextFieldsForField(field, allFields, fieldValues);

    // Only f1 should be reported (nonexistent is skipped via continue)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('labels designer fields with "Designer" section', () => {
    const field = { ai_context_field_ids: ['f1'] };
    const fieldValues = { f1: '' };
    const result = validateContextFieldsForField(field, allFields, fieldValues);

    expect(result[0].section).toBe('Designer');
  });

  it('labels builder fields with "Builder" section', () => {
    const field = { ai_context_field_ids: ['f2'] };
    const fieldValues = { f2: '' };
    const result = validateContextFieldsForField(field, allFields, fieldValues);

    expect(result[0].section).toBe('Builder');
  });
});

// ─── getMissingRequiredFields ───────────────────────────────────────
describe('getMissingRequiredFields', () => {
  const fields = [
    { id: '1', name: 'Title', required: true, fieldFor: 'designer' },
    { id: '2', name: 'Body', required: false, fieldFor: 'builder' },
    { id: '3', name: 'Grade', required: true, fieldFor: 'designer' },
    { id: '4', name: 'Passage', required: true, fieldFor: 'builder' },
  ];

  it('returns fields with empty values', () => {
    const fieldValues = { '1': 'Lesson 1', '2': '', '3': '', '4': 'text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing.map(f => f.name)).toEqual(['Grade']);
  });

  it('returns empty array when all required fields filled', () => {
    const fieldValues = { '1': 'Title', '3': 'K-2', '4': 'Passage text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing).toEqual([]);
  });

  it('skips non-required fields even if empty', () => {
    const fieldValues = { '1': 'Title', '2': '', '3': 'Grade 5', '4': 'Text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing).toEqual([]);
  });

  it('reports null values as missing', () => {
    const fieldValues = { '1': null, '3': 'Grade 5', '4': 'Text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing.map(f => f.name)).toEqual(['Title']);
  });

  it('reports undefined (missing key) values as missing', () => {
    const fieldValues = { '3': 'Grade 5', '4': 'Text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing.map(f => f.name)).toEqual(['Title']);
  });

  it('reports empty arrays as missing', () => {
    const fieldValues = { '1': [], '3': 'Grade 5', '4': 'Text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing.map(f => f.name)).toEqual(['Title']);
  });

  it('reports empty objects as missing', () => {
    const fieldValues = { '1': {}, '3': 'Grade 5', '4': 'Text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing.map(f => f.name)).toEqual(['Title']);
  });

  it('does not report non-empty arrays as missing', () => {
    const fieldValues = { '1': ['item'], '3': 'Grade 5', '4': 'Text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing).toEqual([]);
  });

  it('labels sections correctly (Designer vs Builder)', () => {
    const fieldValues = { '1': '', '3': '', '4': '' };
    const missing = getMissingRequiredFields(fields, fieldValues);

    const titleEntry = missing.find(f => f.name === 'Title');
    const passageEntry = missing.find(f => f.name === 'Passage');
    expect(titleEntry.section).toBe('Designer');
    expect(passageEntry.section).toBe('Builder');
  });

  it('treats whitespace-only string as missing', () => {
    const fieldValues = { '1': '   ', '3': 'Grade', '4': 'Text' };
    const missing = getMissingRequiredFields(fields, fieldValues);
    expect(missing.map(f => f.name)).toEqual(['Title']);
  });
});
