import { TbClockExclamation } from 'react-icons/tb';
import { defineComponent } from '../../../markdown/mdx-components/defineComponent';
import { EntityStaleReport } from './EntityStaleReport';
import { EntityStaleReportDashboardConfigForm } from './EntityStaleReportDashboardConfigForm';
import { entityStaleReportPropsSchema } from './types';

/**
 * Dashboard-only analytics widget: no MDX component or editor registration.
 */
export default defineComponent({
  type: 'entity-stale-report',
  category: 'data-views',
  name: 'Stale entity report',
  description: 'Entities that have not been updated recently.',
  icon: TbClockExclamation,
  component: EntityStaleReport,
  configForm: EntityStaleReportDashboardConfigForm,
  configSchema: entityStaleReportPropsSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace']
  }
});
