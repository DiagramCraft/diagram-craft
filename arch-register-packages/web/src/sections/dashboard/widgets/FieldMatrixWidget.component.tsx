import { TbGrid4X4 } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  FieldMatrixConfigForm,
  FieldMatrixWidget,
  fieldMatrixWidgetConfigSchema
} from './FieldMatrixWidget';

export default defineComponent({
  type: 'FieldMatrix',
  category: 'data-views',
  name: 'Field matrix',
  description:
    'Records placed in a grid of numeric row values against banded numeric values, with clickable record chips.',
  icon: TbGrid4X4,
  component: FieldMatrixWidget,
  configForm: FieldMatrixConfigForm,
  configSchema: fieldMatrixWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 20,
    surfaces: ['workspace', 'project'],
    frame: {
      hideOutsideEdit: config => config.showFrame === false,
      padded: false,
      showIcon: false
    }
  }
});
