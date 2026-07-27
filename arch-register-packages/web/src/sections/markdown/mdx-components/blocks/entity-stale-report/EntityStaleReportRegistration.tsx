import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityStaleReport } from './EntityStaleReport';
import type { EntityStaleReportProps, EntityStaleReportSlateElement } from './types';

export const ENTITY_STALE_REPORT_TYPE = 'entity-stale-report' as const;

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
  surfaces: ['dashboard']
});
