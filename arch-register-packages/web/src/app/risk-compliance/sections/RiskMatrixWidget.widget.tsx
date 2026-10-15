import { TbGridDots } from 'react-icons/tb';
import { defineWidget } from '../../../widgets/shared/defineWidget';
import { RiskMatrixConfigForm } from './RiskMatrixConfigForm';
import { RiskMatrixWidget, riskMatrixWidgetConfigSchema } from './RiskMatrixWidget';
export default defineWidget({
  type: 'risk-compliance-risk-matrix',
  category: 'visualizations',
  name: 'Risk matrix',
  description: 'Likelihood × impact matrix of live risks, with an inherent/residual toggle.',
  icon: TbGridDots,
  component: RiskMatrixWidget,
  configForm: RiskMatrixConfigForm,
  configSchema: riskMatrixWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace']
  }
});
