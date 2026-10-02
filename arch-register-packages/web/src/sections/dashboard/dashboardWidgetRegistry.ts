import {
  getDashboardWidgetSpec as getBaseDashboardWidgetSpec,
  getDashboardWidgetSpecs as getBaseDashboardWidgetSpecs
} from '../markdown/mdx-components/mdxRegistry';
import type { DashboardWidgetSpec } from '../markdown/mdx-components/types';
import { wikiPageWidgetSpec } from './widgets/WikiPageWidget';
import { apiIntegrationCatalogDashboardWidgetSpecs } from '../../app/api-integration-catalog/apiIntegrationCatalogDashboardWidgets';
import { dataStewardshipDashboardWidgetSpecs } from '../../app/data-stewardship/dataStewardshipDashboardWidgets';
import { blastRadiusDashboardWidgetSpec } from './widgets/BlastRadiusWidget';
import {
  ASSESSMENT_STATUS_STAT_TYPE,
  assessmentStatusStatSpec
} from './widgets/AssessmentStatusStatRegistration';
import {
  ASSESSMENT_PROGRESS_TABLE_TYPE,
  assessmentProgressTableSpec
} from './widgets/AssessmentProgressTableRegistration';

import {
  CONFORMANCE_VIOLATIONS_TYPE,
  conformanceViolationsSpec
} from './widgets/ConformanceViolationsRegistration';
import { CHANGE_CASE_TABLE_TYPE, changeCaseTableSpec } from './widgets/ChangeCaseTableRegistration';

const WIKI_PAGE_WIDGET_TYPE = 'wiki-page';

const assessmentDashboardWidgetSpecs: Array<{
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: this registry intentionally erases per-widget config types
  spec: DashboardWidgetSpec<any>;
}> = [
  { type: ASSESSMENT_STATUS_STAT_TYPE, spec: assessmentStatusStatSpec },
  { type: ASSESSMENT_PROGRESS_TABLE_TYPE, spec: assessmentProgressTableSpec },
  { type: CONFORMANCE_VIOLATIONS_TYPE, spec: conformanceViolationsSpec },
  { type: CHANGE_CASE_TABLE_TYPE, spec: changeCaseTableSpec }
];

export const getDashboardWidgetSpecs = (): Array<{
  type: string;
  spec: DashboardWidgetSpec;
}> => [
  ...getBaseDashboardWidgetSpecs(),
  ...apiIntegrationCatalogDashboardWidgetSpecs,
  ...dataStewardshipDashboardWidgetSpecs,
  ...assessmentDashboardWidgetSpecs,
  blastRadiusDashboardWidgetSpec,
  { type: WIKI_PAGE_WIDGET_TYPE, spec: wikiPageWidgetSpec.dashboardWidget! }
];

export const getDashboardWidgetSpec = (type: string): DashboardWidgetSpec | undefined =>
  [
    ...apiIntegrationCatalogDashboardWidgetSpecs,
    ...dataStewardshipDashboardWidgetSpecs,
    ...assessmentDashboardWidgetSpecs,
    blastRadiusDashboardWidgetSpec
  ].find(entry => entry.type === type)?.spec ??
  (type === WIKI_PAGE_WIDGET_TYPE
    ? wikiPageWidgetSpec.dashboardWidget
    : getBaseDashboardWidgetSpec(type));
