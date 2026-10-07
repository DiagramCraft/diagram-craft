import {
  getDashboardWidgetSpec as getBaseDashboardWidgetSpec,
  getDashboardWidgetSpecs as getBaseDashboardWidgetSpecs
} from '../markdown/mdx-components/mdxRegistry';
import type { DashboardWidgetSpec } from '../markdown/mdx-components/types';
import { wikiPageWidgetSpec } from './widgets/WikiPageWidget';
import { apiIntegrationCatalogDashboardWidgetSpecs } from '../../app/api-integration-catalog/apiIntegrationCatalogDashboardWidgets';
import { dataStewardshipDashboardWidgetSpecs } from '../../app/data-stewardship/dataStewardshipDashboardWidgets';
import { riskComplianceDashboardWidgetSpecs } from '../../app/risk-compliance/riskComplianceDashboardWidgets';
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
import { ASSESSMENT_COUNT_TYPE, assessmentCountSpec } from './widgets/AssessmentCountRegistration';
import { RATIO_BAR_LIST_TYPE, ratioBarListSpec } from './widgets/RatioBarListRegistration';
import { COUNT_BY_FIELD_TYPE, countByFieldSpec } from './widgets/CountByFieldRegistration';
import { RELATION_TABLE_TYPE, relationTableSpec } from './widgets/RelationTableRegistration';
import {
  RELATED_ENTITIES_LIST_TYPE,
  relatedEntitiesListSpec
} from './widgets/RelatedEntitiesListRegistration';
import { registerNestedWidgetResolvers } from './widgets/nestedWidgets';
import { TABS_TYPE, tabsSpec } from './widgets/TabsRegistration';
import { PATH_WALKER_TYPE, pathWalkerSpec } from './widgets/PathWalkerRegistration';

const WIKI_PAGE_WIDGET_TYPE = 'wiki-page';

const assessmentDashboardWidgetSpecs: Array<{
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: this registry intentionally erases per-widget config types
  spec: DashboardWidgetSpec<any>;
}> = [
  { type: ASSESSMENT_STATUS_STAT_TYPE, spec: assessmentStatusStatSpec },
  { type: ASSESSMENT_PROGRESS_TABLE_TYPE, spec: assessmentProgressTableSpec },
  { type: CONFORMANCE_VIOLATIONS_TYPE, spec: conformanceViolationsSpec },
  { type: CHANGE_CASE_TABLE_TYPE, spec: changeCaseTableSpec },
  { type: RATIO_BAR_LIST_TYPE, spec: ratioBarListSpec },
  { type: COUNT_BY_FIELD_TYPE, spec: countByFieldSpec },
  { type: ASSESSMENT_COUNT_TYPE, spec: assessmentCountSpec },
  { type: RELATION_TABLE_TYPE, spec: relationTableSpec },
  { type: RELATED_ENTITIES_LIST_TYPE, spec: relatedEntitiesListSpec },
  { type: TABS_TYPE, spec: tabsSpec },
  { type: PATH_WALKER_TYPE, spec: pathWalkerSpec }
];

export const getDashboardWidgetSpecs = (): Array<{
  type: string;
  spec: DashboardWidgetSpec;
}> => [
  ...getBaseDashboardWidgetSpecs(),
  ...apiIntegrationCatalogDashboardWidgetSpecs,
  ...dataStewardshipDashboardWidgetSpecs,
  ...riskComplianceDashboardWidgetSpecs,
  ...assessmentDashboardWidgetSpecs,
  blastRadiusDashboardWidgetSpec,
  { type: WIKI_PAGE_WIDGET_TYPE, spec: wikiPageWidgetSpec.dashboardWidget! }
];

export const getDashboardWidgetSpec = (type: string): DashboardWidgetSpec | undefined =>
  [
    ...apiIntegrationCatalogDashboardWidgetSpecs,
    ...dataStewardshipDashboardWidgetSpecs,
    ...riskComplianceDashboardWidgetSpecs,
    ...assessmentDashboardWidgetSpecs,
    blastRadiusDashboardWidgetSpec
  ].find(entry => entry.type === type)?.spec ??
  (type === WIKI_PAGE_WIDGET_TYPE
    ? wikiPageWidgetSpec.dashboardWidget
    : getBaseDashboardWidgetSpec(type));

registerNestedWidgetResolvers({
  getSpec: getDashboardWidgetSpec,
  getSpecs: getDashboardWidgetSpecs
});
