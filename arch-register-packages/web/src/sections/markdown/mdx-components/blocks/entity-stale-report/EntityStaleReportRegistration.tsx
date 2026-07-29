import { TbClockExclamation } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityStaleReport } from './EntityStaleReport';
import { StaleEntityReportWidget } from '../../../../dashboard/widgets/StaleEntityReportWidget';
import { EntityStaleReportDashboardConfigForm } from './EntityStaleReportDashboardConfigForm';
import type { EntityStaleReportProps, EntityStaleReportSlateElement } from './types';

export const ENTITY_STALE_REPORT_TYPE = 'entity-stale-report' as const;

const hasOptionalInteger = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || (typeof config[key] === 'number' && Number.isInteger(config[key]));

/**
 * Dashboard-only analytics widget: no editorSpec, so it never appears in the
 * wiki slash-command menu or MDX round-trip, regardless of `surfaces`.
 */
export const entityStaleReportSpec = defineMdxComponent<
  EntityStaleReportSlateElement,
  EntityStaleReportProps,
  'block'
>({
  component: EntityStaleReport,
  mode: 'block',
  allowedProps: ['staleAfterDays'],
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbClockExclamation,
    label: 'Stale entity report',
    description: 'Entities that have not been updated recently.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace'],
    component: StaleEntityReportWidget,
    isValidConfig: (config): config is EntityStaleReportProps =>
      hasOptionalInteger(config, 'staleAfterDays'),
    createDefaultConfig: () => ({}),
    configForm: EntityStaleReportDashboardConfigForm
  }
});
