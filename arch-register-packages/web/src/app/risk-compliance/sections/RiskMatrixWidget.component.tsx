import { TbGridDots } from 'react-icons/tb';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { RiskMatrixConfigForm } from './RiskMatrixConfigForm';
import {
  RISK_MATRIX_TYPE,
  RiskMatrixWidget,
  riskMatrixWidgetConfigSchema
} from './RiskMatrixWidget';
import { schemaGuard } from '../../../sections/markdown/mdx-components/configSchema';
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
    isValidConfig: schemaGuard(riskMatrixWidgetConfigSchema)
  }
});
