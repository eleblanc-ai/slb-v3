import { describe, it, expect } from 'vitest';
import { buildFieldResponses } from '../../ai/responseBuilder';

const makeField = (id, name, type, fieldFor) => ({
  id,
  name,
  type,
  fieldFor,
  placeholder: `Placeholder for ${name}`,
});

describe('buildFieldResponses', () => {
  const fields = [
    makeField('f1', 'Title', 'text', 'designer'),
    makeField('f2', 'Passage', 'richtext', 'builder'),
    makeField('f3', 'Topics', 'checklist', 'designer'),
    makeField('f4', 'Cover Image', 'image', 'builder'),
    makeField('f5', 'Questions', 'mcqs', 'builder'),
    makeField('f6', 'Standards', 'assign_standards', 'designer'),
  ];

  const values = {
    f1: 'My Lesson Title',
    f2: '<p>The passage text</p>',
    // f3 not provided → should get empty array default
    // f4 not provided → should get empty image default
    // f5 not provided → should get empty MCQ default
    f6: ['CCSS.1', 'TEKS.2'],
  };

  it('keys responses by field ID when keyBy=id', () => {
    const { designerResponses, builderResponses } = buildFieldResponses(fields, values, { keyBy: 'id' });

    expect(designerResponses.f1).toBe('My Lesson Title');
    expect(designerResponses.f3).toEqual([]);
    expect(designerResponses.f6).toEqual(['CCSS.1', 'TEKS.2']);

    expect(builderResponses.f2).toBe('<p>The passage text</p>');
    expect(builderResponses.f4).toEqual({
      description: '', url: '', altText: '', imageModel: '', altTextModel: '',
    });
    expect(builderResponses.f5).toEqual({ questions: ['', '', '', '', ''] });
  });

  it('keys responses by field name when keyBy=name', () => {
    const { designerResponses, builderResponses } = buildFieldResponses(fields, values, { keyBy: 'name' });

    expect(designerResponses['Title']).toBe('My Lesson Title');
    expect(designerResponses['Topics']).toEqual([]);
    expect(designerResponses['Standards']).toEqual(['CCSS.1', 'TEKS.2']);

    expect(builderResponses['Passage']).toBe('<p>The passage text</p>');
    expect(builderResponses['Cover Image']).toEqual({
      description: '', url: '', altText: '', imageModel: '', altTextModel: '',
    });
    expect(builderResponses['Questions']).toEqual({ questions: ['', '', '', '', ''] });
  });

  it('defaults to keyBy=id when no options given', () => {
    const { designerResponses } = buildFieldResponses(fields, values);
    expect(designerResponses.f1).toBe('My Lesson Title');
    expect(designerResponses['Title']).toBeUndefined();
  });

  it('handles empty fields list', () => {
    const { designerResponses, builderResponses } = buildFieldResponses([], values);
    expect(designerResponses).toEqual({});
    expect(builderResponses).toEqual({});
  });

  it('handles empty values', () => {
    const { designerResponses, builderResponses } = buildFieldResponses(fields, {});
    // All should get type-appropriate defaults
    expect(designerResponses.f1).toBe('');
    expect(designerResponses.f3).toEqual([]);
    expect(designerResponses.f6).toEqual([]);
    expect(builderResponses.f2).toBe('');
    expect(builderResponses.f4).toEqual(expect.objectContaining({ url: '', altText: '' }));
    expect(builderResponses.f5).toEqual({ questions: ['', '', '', '', ''] });
  });

  it('preserves null-ish boundary: null value gets default, defined value is kept', () => {
    const vals = { f1: '', f3: null };
    const { designerResponses } = buildFieldResponses(fields, vals, { keyBy: 'id' });
    // '' is defined and not null, so kept
    expect(designerResponses.f1).toBe('');
    // null triggers the default
    expect(designerResponses.f3).toEqual([]);
  });
});
