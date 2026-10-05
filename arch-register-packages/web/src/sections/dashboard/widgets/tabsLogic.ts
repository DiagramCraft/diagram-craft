import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';

export const TABS_TYPE = 'tabs' as const;
export const TABS_GRID_COLS = 12;

export type TabsWidgetTab = {
  id: string;
  label: string;
  widgets: DashboardWidget[];
};

export type TabsWidgetConfig = {
  tabs: TabsWidgetTab[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isWidget = (value: unknown): value is DashboardWidget =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.type === 'string' &&
  isRecord(value.config) &&
  isNumber(value.x) &&
  isNumber(value.y) &&
  isNumber(value.w) &&
  isNumber(value.h);

/**
 * Structural validity of the tabs config. Whether each child's own config is valid is
 * decided per-child at render/save time through its spec (see `isValidChildWidget`), so
 * that this module does not depend on the widget registry.
 */
export const isValidTabsConfig = (
  config: Record<string, unknown>,
  isValidChildWidget: (widget: DashboardWidget) => boolean = () => true
): config is TabsWidgetConfig =>
  Array.isArray(config.tabs) &&
  config.tabs.length > 0 &&
  config.tabs.every(
    tab =>
      isRecord(tab) &&
      typeof tab.id === 'string' &&
      typeof tab.label === 'string' &&
      tab.label.trim() !== '' &&
      Array.isArray(tab.widgets) &&
      tab.widgets.every(w => isWidget(w) && w.type !== TABS_TYPE && isValidChildWidget(w))
  ) &&
  new Set(config.tabs.map(tab => (tab as TabsWidgetTab).id)).size === config.tabs.length;

/**
 * Flows widgets left to right, wrapping to a new row when the next one does not fit.
 * Row height is the tallest widget in the row. Positions are recomputed whenever a tab's
 * widget list or sizes change, so tab contents never need manual placement.
 */
export const flowLayout = (widgets: DashboardWidget[]): DashboardWidget[] => {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return widgets.map(widget => {
    const w = Math.min(Math.max(widget.w, 1), TABS_GRID_COLS);
    if (x + w > TABS_GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const placed = { ...widget, x, y, w };
    x += w;
    rowHeight = Math.max(rowHeight, widget.h);
    return placed;
  });
};

export const createTab = (existing: TabsWidgetTab[], label = 'Tab'): TabsWidgetTab => ({
  id: `tab-${crypto.randomUUID()}`,
  label: existing.some(tab => tab.label === label) ? `${label} ${existing.length + 1}` : label,
  widgets: []
});

export const moveItem = <T>(items: T[], index: number, delta: -1 | 1): T[] => {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
};

/** Returns the active tab id, falling back to the first tab when the requested one is missing. */
export const resolveActiveTabId = (tabs: TabsWidgetTab[], requested: unknown): string | undefined =>
  tabs.find(tab => tab.id === requested)?.id ?? tabs[0]?.id;
