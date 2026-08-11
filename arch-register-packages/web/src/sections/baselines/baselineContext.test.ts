import { describe, expect, it } from 'vitest';
import type { Baseline } from '@arch-register/api-types/baselineContract';
import { baselineContextSearch } from './baselineContext';

const baseline = (overrides: Partial<Baseline>): Pick<Baseline, 'id'> => ({
  id: 'baseline-1',
  ...overrides
});

describe('baselineContextSearch', () => {
  it('opens a workspace baseline as a named contextual view', () => {
    expect(baselineContextSearch(baseline({}))).toEqual({
      baselineId: 'baseline-1',
      sidebarTab: 'baselines'
    });
  });

  it('uses the same contextual state for project baselines', () => {
    expect(baselineContextSearch(baseline({ id: 'project-baseline-1' }))).toEqual({
      baselineId: 'project-baseline-1',
      sidebarTab: 'baselines'
    });
  });
});
