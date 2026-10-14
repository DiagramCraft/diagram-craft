import { TbGridDots } from 'react-icons/tb';
import { defineComponent } from '../../sections/markdown/mdx-components/defineComponent';
import type { DashboardWidgetSpec } from '../../sections/markdown/mdx-components/types';
import type { ComponentCategory } from '../../sections/markdown/mdx-components/componentCategories';
import { RiskMatrixConfigForm } from './sections/RiskMatrixConfigForm';
import { RiskMatrixWidget, type RiskMatrixWidgetConfig } from './sections/RiskMatrixWidget';

const isOptionalStringArray = (value: unknown): boolean =>
  value === undefined || (Array.isArray(value) && value.every(item => typeof item === 'string'));

export const RISK_MATRIX_TYPE = 'risk-compliance-risk-matrix' as const;

const riskComplianceWidgetSpecs: Array<{
  type: string;
  category: ComponentCategory;
  // biome-ignore lint/suspicious/noExplicitAny: this registry intentionally erases per-widget config types
  spec: DashboardWidgetSpec<any>;
}> = [
  {
    type: RISK_MATRIX_TYPE,
    category: 'visualizations',
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
        (config.includeClosed === undefined || typeof config.includeClosed === 'boolean') &&
        isOptionalStringArray(config.categories) &&
        isOptionalStringArray(config.statuses) &&
        isOptionalStringArray(config.owners),
      createDefaultConfig: () => ({ schemaName: '' }),
      configForm: RiskMatrixConfigForm
    }
  }
];

export const riskComplianceDashboardWidgetSpecs = riskComplianceWidgetSpecs.map(
  ({ type, category, spec }) =>
    defineComponent({ type, category, surfaces: ['dashboard'], dashboardWidget: spec })
);
