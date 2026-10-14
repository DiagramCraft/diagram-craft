import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { FIELD_MATRIX_TYPE, _fieldMatrixSpecData } from './FieldMatrixWidget';

const { icon, component, configForm, createDefaultProps, ...dashboardWidget } = _fieldMatrixSpecData;
export default defineComponent({
  type: FIELD_MATRIX_TYPE,
  category: 'data-views',
  name: 'Field matrix',
  description:
    'Records placed in a grid of numeric row values against banded numeric values, with clickable record chips.',
  component: component!,
  configForm,
  createDefaultProps,
  icon,
  dashboardWidget
});
