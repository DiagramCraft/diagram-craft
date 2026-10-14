import { TbShieldExclamation } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  CONFORMANCE_VIOLATIONS_TYPE,
  ConformanceViolationsConfigForm,
  ConformanceViolationsHeaderActions,
  ConformanceViolationsWidget,
  conformanceViolationsWidgetConfigSchema
} from './ConformanceViolationsWidget';

export default defineComponent({
  type: CONFORMANCE_VIOLATIONS_TYPE,
  category: 'data-views',
  name: 'Conformance violations',
  description:
    'Entities of a schema with active conformance violations, with the failing checks, worst first.',
  icon: TbShieldExclamation,
  component: ConformanceViolationsWidget,
  configForm: ConformanceViolationsConfigForm,
  configSchema: conformanceViolationsWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 14,
    surfaces: ['workspace'],
    headerActionsComponent: ConformanceViolationsHeaderActions,
    frame: { padded: false, showIcon: false }
  }
});
