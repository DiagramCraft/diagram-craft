import { TbGridDots } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../sections/markdown/mdx-components/types';
import { RiskMatrixConfigForm } from './sections/RiskMatrixConfigForm';
import { RiskMatrixWidget, type RiskMatrixWidgetConfig } from './sections/RiskMatrixWidget';

export const RISK_MATRIX_TYPE = 'risk-compliance-risk-matrix' as const;

export const riskComplianceDashboardWidgetSpecs: Array<{
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: this registry intentionally erases per-widget config types
  spec: DashboardWidgetSpec<any>;
}> = [
  {
    type: RISK_MATRIX_TYPE,
    spec: {
      icon: TbGridDots,
      label: 'Risk matrix',
      description: 'Likelihood × impact matrix of live risks, with an inherent/residual toggle.',
      defaultW: 6,
      defaultH: 24,
      surfaces: ['workspace'],
      component: RiskMatrixWidget,
      isValidConfig: (config): config is RiskMatrixWidgetConfig =>
        typeof config.schemaName === 'string' &&
        config.schemaName !== '' &&
        (config.axis === undefined || config.axis === 'inherent' || config.axis === 'residual') &&
        (config.label === undefined || typeof config.label === 'string'),
      createDefaultConfig: () => ({ schemaName: '' }),
      getTitle: config => config.label?.trim() || 'Risk matrix',
      configForm: RiskMatrixConfigForm
    }
  }
];
