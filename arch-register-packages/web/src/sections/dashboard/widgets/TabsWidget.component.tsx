import { TbLayoutList } from 'react-icons/tb';
import { createTab, isValidTabsConfig, TABS_TYPE, type TabsWidgetConfig } from './tabsLogic';
import { getNestedWidgetSpec } from './nestedWidgets';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { TabsConfigForm, TabsWidget } from './TabsWidget';

export default defineComponent({
  type: TABS_TYPE,
  category: 'content-layout',
  name: 'Tabs',
  description: 'Groups other widgets into switchable tabs.',
  icon: TbLayoutList,
  component: TabsWidget,
  createDefaultProps: () => ({ config: { tabs: [createTab([], 'Tab')] } }),
  configForm: TabsConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: (config): config is TabsWidgetConfig =>
      isValidTabsConfig(config, child => {
        const spec = getNestedWidgetSpec(child.type);
        return !!spec && spec.isValidConfig(child.config);
      }),
    dialogSize: 'large'
  }
});
