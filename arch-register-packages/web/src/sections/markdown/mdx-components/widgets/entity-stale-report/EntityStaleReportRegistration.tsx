import { TbClockExclamation } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityStaleReport } from './EntityStaleReport';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
import { EntityStaleReportDashboardConfigForm } from './EntityStaleReportDashboardConfigForm';
import type { EntityStaleReportProps } from './types';

export const ENTITY_STALE_REPORT_TYPE = 'entity-stale-report' as const;

const hasOptionalInteger = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || (typeof config[key] === 'number' && Number.isInteger(config[key]));

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export const entityStaleReportSpec = defineComponent({
  type: ENTITY_STALE_REPORT_TYPE,
  category: 'data-views',
  name: 'Stale entity report',
  description: 'Entities that have not been updated recently.',
  dashboardWidget: {
    icon: TbClockExclamation,
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace'],
    component: createDashboardWidgetAdapter(
      EntityStaleReport,
      (config: EntityStaleReportProps) => ({ staleAfterDays: config.staleAfterDays })
    ),
    isValidConfig: (config): config is EntityStaleReportProps =>
      hasOptionalInteger(config, 'staleAfterDays'),
    createDefaultConfig: () => ({}),
    configForm: EntityStaleReportDashboardConfigForm
  }
});
