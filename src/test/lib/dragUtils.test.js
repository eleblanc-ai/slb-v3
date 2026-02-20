/**
 * Tests for handleFieldDragEnd() — field reordering logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: () => ({ update: mockUpdate }),
  },
}));

// Mock arrayMove from dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (arr, from, to) => {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  },
}));

import { handleFieldDragEnd } from '../../lib/dragUtils';

describe('handleFieldDragEnd', () => {
  const designerFields = [
    { id: 'd1', fieldFor: 'designer', name: 'Title' },
    { id: 'd2', fieldFor: 'designer', name: 'Passage' },
    { id: 'd3', fieldFor: 'designer', name: 'Summary' },
  ];

  const builderFields = [
    { id: 'b1', fieldFor: 'builder', name: 'Question 1' },
  ];

  const allFields = [...designerFields, ...builderFields];
  let setFields;

  beforeEach(() => {
    setFields = vi.fn();
    mockUpdate.mockClear();
  });

  it('does nothing when dropped on itself', async () => {
    await handleFieldDragEnd(
      { active: { id: 'd1' }, over: { id: 'd1' } },
      'designer',
      allFields,
      setFields,
    );
    expect(setFields).not.toHaveBeenCalled();
  });

  it('does nothing when there is no drop target', async () => {
    await handleFieldDragEnd(
      { active: { id: 'd1' }, over: null },
      'designer',
      allFields,
      setFields,
    );
    expect(setFields).not.toHaveBeenCalled();
  });

  it('reorders designer fields without affecting builder fields', async () => {
    await handleFieldDragEnd(
      { active: { id: 'd1' }, over: { id: 'd3' } },
      'designer',
      allFields,
      setFields,
    );

    expect(setFields).toHaveBeenCalledTimes(1);
    const newFields = setFields.mock.calls[0][0];

    // Builder field should still be there
    expect(newFields.find((f) => f.id === 'b1')).toBeTruthy();

    // Designer fields should be reordered: d2, d3, d1 (d1 moved after d3)
    const designers = newFields.filter((f) => f.fieldFor === 'designer');
    expect(designers.map((f) => f.id)).toEqual(['d2', 'd3', 'd1']);
  });

  it('does nothing when active id is not found in filtered fields', async () => {
    await handleFieldDragEnd(
      { active: { id: 'nonexistent' }, over: { id: 'd2' } },
      'designer',
      allFields,
      setFields,
    );
    expect(setFields).not.toHaveBeenCalled();
  });
});
