import { MDX_COMPONENT_DEFINITIONS } from './mdxRegistry';
import type { ComponentDefinition, DashboardWidgetSpec } from './types';
import { defineComponent } from './defineComponent';
import { activityFeedSpec } from '../../dashboard/widgets/ActivityFeedWidget';
import { assessmentsSpec } from '../../dashboard/widgets/AssessmentsWidget';
import { upcomingMilestonesSpec } from '../../dashboard/widgets/UpcomingMilestonesWidget';
import { markdownWidgetSpec } from '../../dashboard/widgets/MarkdownWidget';
import { aggregateStatSpec } from '../../dashboard/widgets/AggregateStatWidget';
import { topEntitiesSpec } from '../../dashboard/widgets/TopEntitiesWidget';
import { conformanceSummarySpec } from '../../dashboard/widgets/ConformanceSummaryWidget';
import { needsAttentionSpec } from '../../dashboard/widgets/NeedsAttentionWidget';
import { apiIntegrationCatalogDashboardWidgetSpecs } from '../../../app/api-integration-catalog/apiIntegrationCatalogDashboardWidgets';
import { dataStewardshipDashboardWidgetSpecs } from '../../../app/data-stewardship/dataStewardshipDashboardWidgets';
import { riskComplianceDashboardWidgetSpecs } from '../../../app/risk-compliance/riskComplianceDashboardWidgets';
import {
  BLAST_RADIUS_WIDGET_TYPE,
  blastRadiusDashboardWidgetSpec
} from '../../dashboard/widgets/BlastRadiusWidget';
import {
  ASSESSMENT_STATUS_STAT_TYPE,
  assessmentStatusStatSpec
} from '../../dashboard/widgets/AssessmentStatusStatWidget';
import {
  ASSESSMENT_PROGRESS_TABLE_TYPE,
  assessmentProgressTableSpec
} from '../../dashboard/widgets/AssessmentProgressTableWidget';
import {
  CONFORMANCE_VIOLATIONS_TYPE,
  conformanceViolationsSpec
} from '../../dashboard/widgets/ConformanceViolationsWidget';
import {
  CHANGE_CASE_TABLE_TYPE,
  changeCaseTableSpec
} from '../../dashboard/widgets/ChangeCaseTableWidget';
import {
  ASSESSMENT_COUNT_TYPE,
  assessmentCountSpec
} from '../../dashboard/widgets/AssessmentCountWidget';
import { RATIO_BAR_LIST_TYPE, ratioBarListSpec } from '../../dashboard/widgets/RatioBarListWidget';
import { COUNT_BY_FIELD_TYPE, countByFieldSpec } from '../../dashboard/widgets/CountByFieldWidget';
import {
  RELATION_TABLE_TYPE,
  relationTableSpec
} from '../../dashboard/widgets/RelationTableWidget';
import {
  RELATION_PAIRS_COVERAGE_TYPE,
  relationPairsCoverageSpec
} from '../../dashboard/widgets/RelationPairsCoverageWidget';
import {
  SPEC_ITEMS_TABLE_TYPE,
  specItemsTableSpec
} from '../../dashboard/widgets/SpecItemsTableWidget';
import {
  RELATED_ENTITIES_LIST_TYPE,
  relatedEntitiesListSpec
} from '../../dashboard/widgets/RelatedEntitiesListWidget';
import {
  TABS_TYPE as DASHBOARD_TABS_TYPE,
  tabsSpec as dashboardTabsSpec
} from '../../dashboard/widgets/TabsWidget';
import { PATH_WALKER_TYPE, pathWalkerSpec } from '../../dashboard/widgets/PathWalkerWidget';
import {
  DATE_BUCKET_CHART_TYPE,
  dateBucketChartSpec
} from '../../dashboard/widgets/DateBucketChartWidget';
import {
  GROUPED_ROLLUP_TABLE_TYPE,
  groupedRollupTableSpec
} from '../../dashboard/widgets/GroupedRollupTableWidget';
import { FIELD_MATRIX_TYPE, fieldMatrixSpec } from '../../dashboard/widgets/FieldMatrixWidget';
import { DATE_CALENDAR_TYPE, dateCalendarSpec } from '../../dashboard/widgets/DateCalendarWidget';
import {
  DATE_RANGE_TIMELINE_TYPE,
  dateRangeTimelineSpec
} from '../../dashboard/widgets/DateRangeTimelineWidget';
import {
  UPCOMING_BY_DATE_TYPE,
  upcomingByDateSpec
} from '../../dashboard/widgets/UpcomingByDateWidget';
import { wikiPageWidgetSpec } from '../../dashboard/widgets/WikiPageWidget';

const dashboardOnlyDefinitions: ReadonlyArray<ComponentDefinition> = [
  ...apiIntegrationCatalogDashboardWidgetSpecs,
  ...dataStewardshipDashboardWidgetSpecs,
  ...riskComplianceDashboardWidgetSpecs,
  activityFeedSpec,
  assessmentsSpec,
  upcomingMilestonesSpec,
  markdownWidgetSpec,
  aggregateStatSpec,
  topEntitiesSpec,
  conformanceSummarySpec,
  needsAttentionSpec,
  defineComponent({
    type: ASSESSMENT_STATUS_STAT_TYPE,
    category: 'metrics',
    surfaces: ['dashboard'],
    dashboardWidget: assessmentStatusStatSpec
  }),
  defineComponent({
    type: ASSESSMENT_PROGRESS_TABLE_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: assessmentProgressTableSpec
  }),
  defineComponent({
    type: CONFORMANCE_VIOLATIONS_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: conformanceViolationsSpec
  }),
  defineComponent({
    type: CHANGE_CASE_TABLE_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: changeCaseTableSpec
  }),
  defineComponent({
    type: ASSESSMENT_COUNT_TYPE,
    category: 'metrics',
    surfaces: ['dashboard'],
    dashboardWidget: assessmentCountSpec
  }),
  defineComponent({
    type: RATIO_BAR_LIST_TYPE,
    category: 'metrics',
    surfaces: ['dashboard'],
    dashboardWidget: ratioBarListSpec
  }),
  defineComponent({
    type: COUNT_BY_FIELD_TYPE,
    category: 'metrics',
    surfaces: ['dashboard'],
    dashboardWidget: countByFieldSpec
  }),
  defineComponent({
    type: RELATION_TABLE_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: relationTableSpec
  }),
  defineComponent({
    type: SPEC_ITEMS_TABLE_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: specItemsTableSpec
  }),
  defineComponent({
    type: RELATION_PAIRS_COVERAGE_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: relationPairsCoverageSpec
  }),
  defineComponent({
    type: RELATED_ENTITIES_LIST_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: relatedEntitiesListSpec
  }),
  defineComponent({
    type: DASHBOARD_TABS_TYPE,
    category: 'content-layout',
    surfaces: ['dashboard'],
    dashboardWidget: dashboardTabsSpec
  }),
  defineComponent({
    type: PATH_WALKER_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: pathWalkerSpec
  }),
  defineComponent({
    type: DATE_BUCKET_CHART_TYPE,
    category: 'visualizations',
    surfaces: ['dashboard'],
    dashboardWidget: dateBucketChartSpec
  }),
  defineComponent({
    type: GROUPED_ROLLUP_TABLE_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: groupedRollupTableSpec
  }),
  defineComponent({
    type: UPCOMING_BY_DATE_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: upcomingByDateSpec
  }),
  defineComponent({
    type: DATE_CALENDAR_TYPE,
    category: 'visualizations',
    surfaces: ['dashboard'],
    dashboardWidget: dateCalendarSpec
  }),
  defineComponent({
    type: DATE_RANGE_TIMELINE_TYPE,
    category: 'visualizations',
    surfaces: ['dashboard'],
    dashboardWidget: dateRangeTimelineSpec
  }),
  defineComponent({
    type: FIELD_MATRIX_TYPE,
    category: 'data-views',
    surfaces: ['dashboard'],
    dashboardWidget: fieldMatrixSpec
  }),
  defineComponent({
    type: BLAST_RADIUS_WIDGET_TYPE,
    category: 'visualizations',
    surfaces: ['dashboard'],
    dashboardWidget: blastRadiusDashboardWidgetSpec.spec
  }),
  wikiPageWidgetSpec
];

/** The single catalog for component identity, category and available surfaces. */
export const COMPONENT_DEFINITIONS: ReadonlyArray<ComponentDefinition> = [
  ...Object.values(MDX_COMPONENT_DEFINITIONS),
  ...dashboardOnlyDefinitions
];

const componentsByType = Object.fromEntries(
  COMPONENT_DEFINITIONS.map(definition => [definition.type, definition])
) as Record<string, ComponentDefinition>;

export const getComponentDefinition = (type: string): ComponentDefinition | undefined =>
  componentsByType[type];

export const isKnownWidgetType = (type: string): boolean =>
  !!componentsByType[type]?.surfaces.includes('dashboard') &&
  !!componentsByType[type]?.dashboardWidget;

export const getDashboardWidgetSpecs = (): Array<{
  type: string;
  category: ComponentDefinition['category'];
  spec: DashboardWidgetSpec;
}> =>
  COMPONENT_DEFINITIONS.flatMap(definition =>
    definition.surfaces.includes('dashboard') && definition.dashboardWidget
      ? [{ type: definition.type, category: definition.category, spec: definition.dashboardWidget }]
      : []
  );

export const getDashboardWidgetSpec = (type: string): DashboardWidgetSpec | undefined => {
  const definition = getComponentDefinition(type);
  return definition?.surfaces.includes('dashboard') ? definition.dashboardWidget : undefined;
};
