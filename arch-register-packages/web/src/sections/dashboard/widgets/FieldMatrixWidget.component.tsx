import { TbGrid4X4 } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  FIELD_MATRIX_TYPE,
  FieldMatrixConfigForm,
  FieldMatrixWidget,
  fieldMatrixWidgetConfigSchema
} from './FieldMatrixWidget';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';

export default defineComponent({
  type: FIELD_MATRIX_TYPE,
  category: 'data-views',
  name: 'Field matrix',
  description:
    'Records placed in a grid of numeric row values against banded numeric values, with clickable record chips.',
  icon: TbGrid4X4,
  component: FieldMatrixWidget,
  createDefaultProps: () => ({
    config: {
      query: '',
      rowFieldId: '',
      rows: [3, 2, 1],
      valueFieldId: '',
      bands: [
        { label: 'Low', min: 0, tone: 'good' },
        { label: 'High', min: 3, tone: 'bad' }
      ]
    }
  }),
  configForm: FieldMatrixConfigForm,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 20,
    surfaces: ['workspace', 'project'],
    frame: {
      hideOutsideEdit: config => config.showFrame === false,
      padded: false,
      showIcon: false
    },
    isValidConfig: schemaGuard(fieldMatrixWidgetConfigSchema)
  }
});
