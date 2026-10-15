import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';
import {
  dashboardWidgetSchema,
  type DashboardWidget
} from '@arch-register/api-types/dashboardContract';

export const TABS_TYPE = 'tabs' as const;

// Declared with explicit types: the tabs schema's starting value calls this, so inferring the tab
// type from the schema here would be circular.
type NewTab = { id: string; label: string; widgets: DashboardWidget[] };

export const createTab = (existing: ReadonlyArray<{ label: string }>, label = 'Tab'): NewTab => ({
  id: `tab-${crypto.randomUUID()}`,
  label: existing.some(tab => tab.label === label) ? `${label} ${existing.length + 1}` : label,
  widgets: []
});

/**
 * Builds the tabs config schema. Whether each child's own config is valid is decided by
 * `isValidChildWidget`, so this module does not depend on the widget registry.
 */
export const createTabsConfigSchema = (
  isValidChildWidget: (widget: DashboardWidget) => boolean = () => true
) =>
  z
    .object({
      tabs: withInitial(
        z
          .array(
            z.object({
              id: z.string(),
              label: z.string().trim().min(1),
              widgets: z.array(
                dashboardWidgetSchema.refine(
                  widget => widget.type !== TABS_TYPE && isValidChildWidget(widget),
                  { message: 'A tab cannot hold another tabs widget or an invalid widget' }
                )
              )
            })
          )
          .min(1),
        () => [createTab([], 'Tab')]
      )
    })
    .refine(config => new Set(config.tabs.map(tab => tab.id)).size === config.tabs.length, {
      message: 'Tab ids must be unique'
    });

export const tabsWidgetConfigSchema = createTabsConfigSchema();

export type TabsWidgetConfig = z.infer<typeof tabsWidgetConfigSchema>;
export type TabsWidgetTab = TabsWidgetConfig['tabs'][number];

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
