import { TbShieldCheck } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  CONFORMANCE_SUMMARY_TYPE,
  ConformanceSummaryWidget,
  conformanceSummaryWidgetConfigSchema
} from './ConformanceSummaryWidget';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';
export default defineComponent({
  type: CONFORMANCE_SUMMARY_TYPE,
  category: 'data-views',
  name: 'Conformance summary',
  description: 'Current conformance violations grouped by severity, check, and schema.',
  icon: TbShieldCheck,
  component: ConformanceSummaryWidget,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    defaultW: 5,
    defaultH: 16,
    surfaces: ['workspace'],
    isValidConfig: schemaGuard(conformanceSummaryWidgetConfigSchema)
  }
});
