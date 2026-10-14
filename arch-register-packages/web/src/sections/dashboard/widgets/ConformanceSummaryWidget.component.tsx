import { TbShieldCheck } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  CONFORMANCE_SUMMARY_TYPE,
  ConformanceSummaryWidget,
  conformanceSummaryWidgetConfigSchema
} from './ConformanceSummaryWidget';
export default defineComponent({
  type: CONFORMANCE_SUMMARY_TYPE,
  category: 'data-views',
  name: 'Conformance summary',
  description: 'Current conformance violations grouped by severity, check, and schema.',
  icon: TbShieldCheck,
  component: ConformanceSummaryWidget,
  configSchema: conformanceSummaryWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 5,
    defaultH: 16,
    surfaces: ['workspace']
  }
});
