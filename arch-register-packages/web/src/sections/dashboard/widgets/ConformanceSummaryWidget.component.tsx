import { TbShieldCheck } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import type { ConformanceSummaryWidgetConfig } from './ConformanceSummaryWidget';
import { CONFORMANCE_SUMMARY_TYPE, ConformanceSummaryWidget } from './ConformanceSummaryWidget';
export default defineComponent({
  type: CONFORMANCE_SUMMARY_TYPE,
  category: 'data-views',
  name: 'Conformance summary',
  description: 'Current conformance violations grouped by severity, check, and schema.',
  component: ConformanceSummaryWidget,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    icon: TbShieldCheck,
    defaultW: 5,
    defaultH: 16,
    surfaces: ['workspace'],
    isValidConfig: (config): config is ConformanceSummaryWidgetConfig =>
      Object.keys(config).length === 0
  }
});
