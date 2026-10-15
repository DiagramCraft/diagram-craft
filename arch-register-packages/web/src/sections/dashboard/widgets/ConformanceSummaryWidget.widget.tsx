import { TbShieldCheck } from 'react-icons/tb';
import { defineWidget } from '../../markdown/mdx-components/defineWidget';
import {
  ConformanceSummaryWidget,
  conformanceSummaryWidgetConfigSchema
} from './ConformanceSummaryWidget';
export default defineWidget({
  type: 'conformance-violation-summary',
  category: 'data-views',
  name: 'Conformance summary',
  description: 'Current conformance violations grouped by severity, check, and schema.',
  icon: TbShieldCheck,
  component: ConformanceSummaryWidget,
  configSchema: conformanceSummaryWidgetConfigSchema,
  dashboard: {
    defaultW: 5,
    defaultH: 16,
    surfaces: ['workspace']
  }
});
