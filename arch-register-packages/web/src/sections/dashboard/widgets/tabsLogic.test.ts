import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import {
  createTab,
  flowLayout,
  isValidTabsConfig,
  moveItem,
  resolveActiveTabId
} from './tabsLogic';

const widget = (id: string, w: number, h: number, type = 'x'): DashboardWidget => ({
  id,
  type,
  config: {},
  x: 0,
  y: 0,
  w,
  h
});

describe('flowLayout', () => {
  it('places widgets side by side and wraps on overflow', () => {
    const result = flowLayout([widget('a', 6, 4), widget('b', 6, 8), widget('c', 6, 3)]);
    expect(result.map(r => [r.x, r.y])).toEqual([
      [0, 0],
      [6, 0],
      [0, 8]
    ]);
  });

  it('clamps width to the grid', () => {
    expect(flowLayout([widget('a', 20, 4)])[0]!.w).toBe(12);
  });
});

describe('isValidTabsConfig', () => {
  const tab = (id: string, label: string, widgets: DashboardWidget[] = []) => ({
    id,
    label,
    widgets
  });

  it('accepts a valid config', () => {
    expect(isValidTabsConfig({ tabs: [tab('1', 'A', [widget('a', 3, 3)]), tab('2', 'B')] })).toBe(
      true
    );
  });

  it('rejects empty, blank-label and duplicate-id tabs', () => {
    expect(isValidTabsConfig({ tabs: [] })).toBe(false);
    expect(isValidTabsConfig({ tabs: [tab('1', ' ')] })).toBe(false);
    expect(isValidTabsConfig({ tabs: [tab('1', 'A'), tab('1', 'B')] })).toBe(false);
  });

  it('rejects nested tabs and invalid children', () => {
    expect(isValidTabsConfig({ tabs: [tab('1', 'A', [widget('a', 3, 3, 'tabs')])] })).toBe(false);
    expect(isValidTabsConfig({ tabs: [tab('1', 'A', [widget('a', 3, 3)])] }, () => false)).toBe(
      false
    );
  });
});

describe('helpers', () => {
  it('moveItem swaps neighbours and ignores out-of-range moves', () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });

  it('resolveActiveTabId falls back to the first tab', () => {
    const tabs = [createTab([], 'A'), createTab([], 'B')];
    expect(resolveActiveTabId(tabs, tabs[1]!.id)).toBe(tabs[1]!.id);
    expect(resolveActiveTabId(tabs, 'missing')).toBe(tabs[0]!.id);
  });
});
