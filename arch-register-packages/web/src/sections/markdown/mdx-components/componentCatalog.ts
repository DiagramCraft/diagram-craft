import { MDX_COMPONENT_DEFINITIONS } from './mdxRegistry';
import type { ComponentDefinition, DashboardWidgetSpec } from './types';
import { activityFeedSpec } from '../../dashboard/widgets/ActivityFeedWidget';
import { aggregateStatSpec } from '../../dashboard/widgets/AggregateStatWidget';
import { assessmentCountSpec } from '../../dashboard/widgets/AssessmentCountWidget';
import { assessmentProgressTableSpec } from '../../dashboard/widgets/AssessmentProgressTableWidget';
import { assessmentStatusStatSpec } from '../../dashboard/widgets/AssessmentStatusStatWidget';
import { assessmentsSpec } from '../../dashboard/widgets/AssessmentsWidget';
import { blastRadiusSpec } from '../../dashboard/widgets/BlastRadiusWidget';
import { changeCaseTableSpec } from '../../dashboard/widgets/ChangeCaseTableWidget';
import { conformanceSummarySpec } from '../../dashboard/widgets/ConformanceSummaryWidget';
import { conformanceViolationsSpec } from '../../dashboard/widgets/ConformanceViolationsWidget';
import { countByFieldSpec } from '../../dashboard/widgets/CountByFieldWidget';
import { dateBucketChartSpec } from '../../dashboard/widgets/DateBucketChartWidget';
import { dateCalendarSpec } from '../../dashboard/widgets/DateCalendarWidget';
import { dateRangeTimelineSpec } from '../../dashboard/widgets/DateRangeTimelineWidget';
import { fieldMatrixSpec } from '../../dashboard/widgets/FieldMatrixWidget';
import { groupedRollupTableSpec } from '../../dashboard/widgets/GroupedRollupTableWidget';
import { markdownWidgetSpec } from '../../dashboard/widgets/MarkdownWidget';
import { needsAttentionSpec } from '../../dashboard/widgets/NeedsAttentionWidget';
import { pathWalkerSpec } from '../../dashboard/widgets/PathWalkerWidget';
import { ratioBarListSpec } from '../../dashboard/widgets/RatioBarListWidget';
import { relatedEntitiesListSpec } from '../../dashboard/widgets/RelatedEntitiesListWidget';
import { relationPairsCoverageSpec } from '../../dashboard/widgets/RelationPairsCoverageWidget';
import { relationTableSpec } from '../../dashboard/widgets/RelationTableWidget';
import { specItemsTableSpec } from '../../dashboard/widgets/SpecItemsTableWidget';
import { tabsSpec } from '../../dashboard/widgets/TabsWidget';
import { topEntitiesSpec } from '../../dashboard/widgets/TopEntitiesWidget';
import { upcomingByDateSpec } from '../../dashboard/widgets/UpcomingByDateWidget';
import { upcomingMilestonesSpec } from '../../dashboard/widgets/UpcomingMilestonesWidget';
import { wikiPageWidgetSpec } from '../../dashboard/widgets/WikiPageWidget';
import { apiCatalogAtRiskSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogAtRiskWidget';
import { apiCatalogImpactSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogImpactWidget';
import { apiCatalogMostConsumedSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogMostConsumedWidget';
import { apiCatalogNeedsAttentionCountSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogNeedsAttentionCountWidget';
import { apiCatalogNeedsAttentionSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogNeedsAttentionWidget';
import { apiCatalogPairGapsSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogPairGapsWidget';
import { apiCatalogStatsSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogStatsWidget';
import { caseCalendarSpec } from '../../../app/data-stewardship/widgets/CaseCalendarWidget';
import { caseCountSpec } from '../../../app/data-stewardship/widgets/CaseCountWidget';
import { caseQueueSpec } from '../../../app/data-stewardship/widgets/CaseQueueWidget';
import { reviewsOverdueSpec } from '../../../app/data-stewardship/widgets/ReviewsOverdueWidget';
import { riskMatrixSpec } from '../../../app/risk-compliance/sections/RiskMatrixWidget';
import { entityLifecycleChartSpec } from './widgets/entity-lifecycle-chart/EntityLifecycleChartRegistration';
import { entityActivityTrendChartSpec } from './widgets/entity-activity-trend-chart/EntityActivityTrendChartRegistration';
import { entityStaleReportSpec } from './widgets/entity-stale-report/EntityStaleReportRegistration';

const dashboardOnlyDefinitions: ReadonlyArray<ComponentDefinition> = [
  activityFeedSpec,
  aggregateStatSpec,
  apiCatalogAtRiskSpec,
  apiCatalogImpactSpec,
  apiCatalogMostConsumedSpec,
  apiCatalogNeedsAttentionCountSpec,
  apiCatalogNeedsAttentionSpec,
  apiCatalogPairGapsSpec,
  apiCatalogStatsSpec,
  assessmentCountSpec,
  assessmentProgressTableSpec,
  assessmentStatusStatSpec,
  assessmentsSpec,
  blastRadiusSpec,
  caseCalendarSpec,
  caseCountSpec,
  caseQueueSpec,
  entityActivityTrendChartSpec,
  entityLifecycleChartSpec,
  entityStaleReportSpec,
  changeCaseTableSpec,
  conformanceSummarySpec,
  conformanceViolationsSpec,
  countByFieldSpec,
  dateBucketChartSpec,
  dateCalendarSpec,
  dateRangeTimelineSpec,
  fieldMatrixSpec,
  groupedRollupTableSpec,
  markdownWidgetSpec,
  needsAttentionSpec,
  pathWalkerSpec,
  ratioBarListSpec,
  relatedEntitiesListSpec,
  relationPairsCoverageSpec,
  relationTableSpec,
  reviewsOverdueSpec,
  riskMatrixSpec,
  specItemsTableSpec,
  tabsSpec,
  topEntitiesSpec,
  upcomingByDateSpec,
  upcomingMilestonesSpec,
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
