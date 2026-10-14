import { TbGrid4X4 } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  FIELD_MATRIX_TYPE,
  FieldMatrixConfigForm,
  FieldMatrixWidget,
  FieldMatrixWidgetConfig,
  isBand,
  isFieldMatrixConfigComplete
} from './FieldMatrixWidget';
import { isOptionalString } from '../../markdown/mdx-components/configGuards';

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
    isValidConfig: (config): config is FieldMatrixWidgetConfig =>
      typeof config.rowFieldId === 'string' &&
      typeof config.valueFieldId === 'string' &&
      Array.isArray(config.rows) &&
      config.rows.every(row => typeof row === 'number') &&
      Array.isArray(config.bands) &&
      config.bands.every(isBand) &&
      isOptionalString(config.query) &&
      isOptionalString(config.schemaName) &&
      isOptionalString(config.cornerLabel) &&
      (config.showFrame === undefined || typeof config.showFrame === 'boolean') &&
      (config.hotRowMin === undefined || typeof config.hotRowMin === 'number') &&
      isFieldMatrixConfigComplete(config as FieldMatrixWidgetConfig)
  }
});
