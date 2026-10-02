import { describe, expect, it } from 'vitest';
import {
  isFacetsConfigValid,
  isOptionsConfigValid,
  moveItem,
  normalizeFacets,
  normalizeOptions
} from './dashboardSidebarConfig';

const facet = (fieldId: string, variableName: string) => ({ fieldId, variableName });

describe('moveItem', () => {
  it('swaps with neighbour', () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
  });
  it('is a no-op at the edges', () => {
    expect(moveItem([1, 2], 0, -1)).toEqual([1, 2]);
    expect(moveItem([1, 2], 1, 1)).toEqual([1, 2]);
  });
});

describe('isFacetsConfigValid', () => {
  it('accepts a valid config', () => {
    expect(isFacetsConfigValid('Term', [facet('_owner', 'owner'), facet('Cat', 'cat')])).toBe(true);
  });
  it('rejects missing schema, empty facets, bad or duplicate names, missing field', () => {
    expect(isFacetsConfigValid('', [facet('_owner', 'o')])).toBe(false);
    expect(isFacetsConfigValid('Term', [])).toBe(false);
    expect(isFacetsConfigValid('Term', [facet('_owner', '1x')])).toBe(false);
    expect(isFacetsConfigValid('Term', [facet('_owner', 'a'), facet('_lifecycle', 'a')])).toBe(
      false
    );
    expect(isFacetsConfigValid('Term', [facet('', 'a')])).toBe(false);
  });
});

describe('normalizeFacets', () => {
  it('trims and drops empty labels', () => {
    expect(normalizeFacets([{ fieldId: '_owner', variableName: ' o ', itemLabel: '  ' }])).toEqual([
      { fieldId: '_owner', variableName: 'o', itemLabel: undefined }
    ]);
  });
});

describe('isOptionsConfigValid', () => {
  const option = (value: string, label: string) => ({ value, label });

  it('accepts a valid config', () => {
    expect(isOptionsConfigValid('status', [option('open', 'Open'), option('done', 'Done')])).toBe(
      true
    );
  });
  it('rejects a bad variable name, no options, blank or duplicate values and blank labels', () => {
    expect(isOptionsConfigValid('1x', [option('a', 'A')])).toBe(false);
    expect(isOptionsConfigValid('status', [])).toBe(false);
    expect(isOptionsConfigValid('status', [option(' ', 'A')])).toBe(false);
    expect(isOptionsConfigValid('status', [option('a', 'A'), option('a', 'B')])).toBe(false);
    expect(isOptionsConfigValid('status', [option('a', ' ')])).toBe(false);
  });
});

describe('normalizeOptions', () => {
  it('trims values and labels', () => {
    expect(normalizeOptions([{ value: ' a ', label: ' A ' }])).toEqual([
      { value: 'a', label: 'A' }
    ]);
  });
});
