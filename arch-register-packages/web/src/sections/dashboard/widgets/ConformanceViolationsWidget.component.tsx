import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  CONFORMANCE_VIOLATIONS_TYPE,
  _conformanceViolationsSpecData
} from './ConformanceViolationsWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _conformanceViolationsSpecData;
export default defineComponent({
  type: CONFORMANCE_VIOLATIONS_TYPE,
  category: 'data-views',
  name: 'Conformance violations',
  description:
    'Entities of a schema with active conformance violations, with the failing checks, worst first.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
