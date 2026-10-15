import { TbGrid4X4 } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { FieldMatrixConfigForm } from './FieldMatrixConfigForm';
import { FieldMatrixWidget } from './FieldMatrix';
import { fieldMatrixWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'FieldMatrix',
  category: 'data-views',
  name: 'Field matrix',
  description:
    'Records placed in a grid of numeric row values against banded numeric values, with clickable record chips.',
  icon: TbGrid4X4,
  component: FieldMatrixWidget,
  configForm: FieldMatrixConfigForm,
  configSchema: fieldMatrixWidgetConfigSchema,
  dashboard: {
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
