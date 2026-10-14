import { TbGridDots } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { RiskMatrixConfigForm } from './RiskMatrixConfigForm';
import {
  RISK_MATRIX_TYPE,
  RiskMatrixWidget,
  riskMatrixWidgetConfigSchema
} from './RiskMatrixWidget';
export default defineComponent({
  type: RISK_MATRIX_TYPE,
  category: 'visualizations',
  name: 'Risk matrix',
  description: 'Likelihood × impact matrix of live risks, with an inherent/residual toggle.',
  icon: TbGridDots,
  component: RiskMatrixWidget,
  configForm: RiskMatrixConfigForm,
  configSchema: riskMatrixWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace']
  }
});
