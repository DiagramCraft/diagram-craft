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
} from './widgets/AssessmentStatusStatWidget';
import {
  ASSESSMENT_PROGRESS_TABLE_TYPE,
  assessmentProgressTableSpec
} from './widgets/AssessmentProgressTableWidget';

import {
  CONFORMANCE_VIOLATIONS_TYPE,
  conformanceViolationsSpec
} from './widgets/ConformanceViolationsWidget';
import { CHANGE_CASE_TABLE_TYPE, changeCaseTableSpec } from './widgets/ChangeCaseTableWidget';
import { ASSESSMENT_COUNT_TYPE, assessmentCountSpec } from './widgets/AssessmentCountWidget';
import { RATIO_BAR_LIST_TYPE, ratioBarListSpec } from './widgets/RatioBarListWidget';
import { COUNT_BY_FIELD_TYPE, countByFieldSpec } from './widgets/CountByFieldWidget';
import { RELATION_TABLE_TYPE, relationTableSpec } from './widgets/RelationTableWidget';
import {
  RELATION_PAIRS_COVERAGE_TYPE,
  relationPairsCoverageSpec
} from './widgets/RelationPairsCoverageWidget';
import { SPEC_ITEMS_TABLE_TYPE, specItemsTableSpec } from './widgets/SpecItemsTableWidget';
import {
  RELATED_ENTITIES_LIST_TYPE,
  relatedEntitiesListSpec
} from './widgets/RelatedEntitiesListWidget';
import { registerNestedWidgetResolvers } from './widgets/nestedWidgets';
import { TABS_TYPE, tabsSpec } from './widgets/TabsWidget';
import { PATH_WALKER_TYPE, pathWalkerSpec } from './widgets/PathWalkerWidget';
import { DATE_BUCKET_CHART_TYPE, dateBucketChartSpec } from './widgets/DateBucketChartWidget';
import {
  GROUPED_ROLLUP_TABLE_TYPE,
  groupedRollupTableSpec
} from './widgets/GroupedRollupTableWidget';
import { FIELD_MATRIX_TYPE, fieldMatrixSpec } from './widgets/FieldMatrixWidget';
import { DATE_CALENDAR_TYPE, dateCalendarSpec } from './widgets/DateCalendarWidget';
import {
  DATE_RANGE_TIMELINE_TYPE,
  dateRangeTimelineSpec
} from './widgets/DateRangeTimelineWidget';
import { UPCOMING_BY_DATE_TYPE, upcomingByDateSpec } from './widgets/UpcomingByDateWidget';

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
  { type: SPEC_ITEMS_TABLE_TYPE, spec: specItemsTableSpec },
  { type: RELATION_PAIRS_COVERAGE_TYPE, spec: relationPairsCoverageSpec },
  { type: RELATED_ENTITIES_LIST_TYPE, spec: relatedEntitiesListSpec },
  { type: TABS_TYPE, spec: tabsSpec },
  { type: PATH_WALKER_TYPE, spec: pathWalkerSpec },
  { type: DATE_BUCKET_CHART_TYPE, spec: dateBucketChartSpec },
  { type: GROUPED_ROLLUP_TABLE_TYPE, spec: groupedRollupTableSpec },
  { type: UPCOMING_BY_DATE_TYPE, spec: upcomingByDateSpec },
  { type: DATE_CALENDAR_TYPE, spec: dateCalendarSpec },
  { type: DATE_RANGE_TIMELINE_TYPE, spec: dateRangeTimelineSpec },
  { type: FIELD_MATRIX_TYPE, spec: fieldMatrixSpec }
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
