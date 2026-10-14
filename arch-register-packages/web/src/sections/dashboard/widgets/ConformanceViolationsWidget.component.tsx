import { TbShieldExclamation } from 'react-icons/tb';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';
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
  createDefaultProps: () => ({ config: { schemaName: '', limit: 8 } }),
  configForm: ConformanceViolationsConfigForm,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 14,
    surfaces: ['workspace'],
    headerActionsComponent: ConformanceViolationsHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: schemaGuard(conformanceViolationsWidgetConfigSchema)
  }
});
