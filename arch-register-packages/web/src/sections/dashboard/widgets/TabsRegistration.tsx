import { TbLayoutList } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { getNestedWidgetSpec } from './nestedWidgets';
import { TabsConfigForm } from './TabsConfigForm';
import { TabsWidget } from './TabsWidget';
import { createTab, isValidTabsConfig, TABS_TYPE, type TabsWidgetConfig } from './tabsLogic';

export { TABS_TYPE };

export const tabsSpec: DashboardWidgetSpec<TabsWidgetConfig> = {
  icon: TbLayoutList,
  label: 'Tabs',
  description: 'Groups other widgets into switchable tabs.',
  defaultW: 12,
  defaultH: 24,
  surfaces: ['workspace', 'project'],
  component: TabsWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is TabsWidgetConfig =>
    isValidTabsConfig(config, child => {
      const spec = getNestedWidgetSpec(child.type);
      return !!spec && spec.isValidConfig(child.config);
    }),
  createDefaultConfig: () => ({ tabs: [createTab([], 'Tab')] }),
  getTitle: () => 'Tabs',
  configForm: TabsConfigForm,
  dialogWidth: 640
};
