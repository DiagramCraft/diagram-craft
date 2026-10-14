import { TbClockExclamation } from 'react-icons/tb';
import { defineComponent } from '../../../markdown/mdx-components/defineComponent';
import { EntityStaleReport } from './EntityStaleReport';
import { EntityStaleReportDashboardConfigForm } from './EntityStaleReportDashboardConfigForm';
import type { EntityStaleReportProps } from './types';
import { hasOptionalInteger } from '../../../markdown/mdx-components/configGuards';

export const ENTITY_STALE_REPORT_TYPE = 'entity-stale-report' as const;

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: ENTITY_STALE_REPORT_TYPE,
  category: 'data-views',
  name: 'Stale entity report',
  description: 'Entities that have not been updated recently.',
  icon: TbClockExclamation,
  component: EntityStaleReport,
  configForm: EntityStaleReportDashboardConfigForm,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace'],
    isValidConfig: (config): config is EntityStaleReportProps =>
      hasOptionalInteger(config, 'staleAfterDays')
  }
});
