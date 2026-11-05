import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import {
  createTab,
  createTabsConfigSchema,
  resolveActiveTabId,
  tabsWidgetConfigSchema
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

describe('tabs config schema', () => {
  const isValidTabsConfig = (
    config: unknown,
    isValidChild?: (widget: DashboardWidget) => boolean
  ) =>
    (isValidChild ? createTabsConfigSchema(isValidChild) : tabsWidgetConfigSchema).safeParse(config)
      .success;

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
  it('resolveActiveTabId falls back to the first tab', () => {
    const tabs = [createTab([], 'A'), createTab([], 'B')];
    expect(resolveActiveTabId(tabs, tabs[1]!.id)).toBe(tabs[1]!.id);
    expect(resolveActiveTabId(tabs, 'missing')).toBe(tabs[0]!.id);
  });
});
