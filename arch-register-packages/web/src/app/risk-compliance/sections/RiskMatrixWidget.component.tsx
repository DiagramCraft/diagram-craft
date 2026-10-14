import { TbGridDots } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { RiskMatrixConfigForm } from './RiskMatrixConfigForm';
import type { RiskMatrixWidgetConfig } from './RiskMatrixWidget';
import { RISK_MATRIX_TYPE, RiskMatrixWidget, isOptionalStringArray } from './RiskMatrixWidget';
export default defineComponent({
  type: RISK_MATRIX_TYPE,
  category: 'visualizations',
  name: 'Risk matrix',
  description: 'Likelihood × impact matrix of live risks, with an inherent/residual toggle.',
  icon: TbGridDots,
  component: RiskMatrixWidget,
  createDefaultProps: () => ({ config: { schemaName: '' } }),
  configForm: RiskMatrixConfigForm,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace'],
    isValidConfig: (config): config is RiskMatrixWidgetConfig =>
      typeof config.schemaName === 'string' &&
      config.schemaName !== '' &&
      (config.axis === undefined || config.axis === 'inherent' || config.axis === 'residual') &&
      (config.includeClosed === undefined || typeof config.includeClosed === 'boolean') &&
      isOptionalStringArray(config.categories) &&
      isOptionalStringArray(config.statuses) &&
      isOptionalStringArray(config.owners)
  }
});
