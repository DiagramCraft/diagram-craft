import { describe, expect, test } from 'vitest';
import { BROWSER_VIEW_OPTIONS, groupViewOptions } from './browserViewMeta';

describe('groupViewOptions', () => {
  test('groups all views under the four headings', () => {
    const groups = groupViewOptions(BROWSER_VIEW_OPTIONS);
    expect(groups.map(g => g.label)).toEqual(['Lists', 'Charts', 'Time', 'Relationships']);
    expect(groups.flatMap(g => g.options)).toHaveLength(BROWSER_VIEW_OPTIONS.length);
  });

  test('drops groups without allowed views', () => {
    const groups = groupViewOptions([
      { value: 'table', label: 'Table' },
      { value: 'cards', label: 'Cards' }
    ]);
    expect(groups).toEqual([
      {
        label: 'Lists',
        options: [
          { value: 'table', label: 'Table' },
          { value: 'cards', label: 'Cards' }
        ]
      }
    ]);
  });

  test('returns no groups for no options', () => {
    expect(groupViewOptions([])).toEqual([]);
  });
});
