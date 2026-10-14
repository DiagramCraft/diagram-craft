import { diagramEmbedSpec } from './blocks/diagram-embed/DiagramEmbedRegistration';
import { imageEmbedSpec } from './blocks/image-embed/ImageEmbedRegistration';
import { entityBrowserEmbedSpec } from './blocks/entity-browser-embed/EntityBrowserEmbedRegistration';
import { entityCardSpec } from './blocks/entity-card/EntityCardRegistration';
import { entityChangelogSpec } from './blocks/entity-changelog/EntityChangelogRegistration';
import { entityChartSpec } from './blocks/entity-chart/EntityChartRegistration';
import { metricSpec } from './blocks/metric/MetricRegistration';
import { entityTableSpec } from './blocks/entity-table/EntityTableRegistration';
import { entityViewEmbedSpec } from './blocks/entity-view-embed/EntityViewEmbedRegistration';
import { entityGraphSpec } from './blocks/entity-graph/EntityGraphRegistration';
import { documentBrowserEmbedSpec } from './blocks/document-browser-embed/DocumentBrowserEmbedRegistration';
import { entityFieldSpec } from './inlines/entity-field/EntityFieldRegistration';
import { entityMentionSpec } from './inlines/entity-mention/EntityMentionRegistration';
import { entityLinkSpec } from './inlines/entity-link/EntityLinkRegistration';
import { labelSpec } from './inlines/label/LabelRegistration';
import { captionSpec } from './blocks/caption/CaptionRegistration';
import { calloutSpec } from './blocks/callout/CalloutRegistration';
import { foldableSectionSpec } from './blocks/foldable-section/FoldableSectionRegistration';
import { columnsSpec } from './blocks/columns/ColumnsRegistration';
import { columnSpec } from './blocks/columns/ColumnRegistration';
import { tabsSpec } from './blocks/tabs/TabsRegistration';
import { tabSpec } from './blocks/tabs/TabRegistration';
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
import { tabsSpec as dashboardTabsSpec } from '../../dashboard/widgets/TabsWidget';
import { topEntitiesSpec } from '../../dashboard/widgets/TopEntitiesWidget';
import { upcomingByDateSpec } from '../../dashboard/widgets/UpcomingByDateWidget';
import { upcomingMilestonesSpec } from '../../dashboard/widgets/UpcomingMilestonesWidget';
import { wikiPageWidgetSpec } from '../../dashboard/widgets/WikiPageWidget';
import { apiCatalogAtRiskSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogAtRiskWidget';
import { apiCatalogImpactSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogImpactWidget';
import { apiCatalogMostConsumedSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogMostConsumedWidget';
import {
  apiCatalogNeedsAttentionCountSpec
} from '../../../app/api-integration-catalog/widgets/ApiCatalogNeedsAttentionCountWidget';
import {
  apiCatalogNeedsAttentionSpec
} from '../../../app/api-integration-catalog/widgets/ApiCatalogNeedsAttentionWidget';
import { apiCatalogPairGapsSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogPairGapsWidget';
import { apiCatalogStatsSpec } from '../../../app/api-integration-catalog/widgets/ApiCatalogStatsWidget';
import { caseCalendarSpec } from '../../../app/data-stewardship/widgets/CaseCalendarWidget';
import { caseCountSpec } from '../../../app/data-stewardship/widgets/CaseCountWidget';
import { caseQueueSpec } from '../../../app/data-stewardship/widgets/CaseQueueWidget';
import { reviewsOverdueSpec } from '../../../app/data-stewardship/widgets/ReviewsOverdueWidget';
import { riskMatrixSpec } from '../../../app/risk-compliance/sections/RiskMatrixWidget';
import { entityLifecycleChartSpec } from './widgets/entity-lifecycle-chart/EntityLifecycleChartRegistration';
import {
  entityActivityTrendChartSpec
} from './widgets/entity-activity-trend-chart/EntityActivityTrendChartRegistration';
import { entityStaleReportSpec } from './widgets/entity-stale-report/EntityStaleReportRegistration';
import { registerComponentDefinitions } from './componentRegistry';

registerComponentDefinitions([
  diagramEmbedSpec,
  imageEmbedSpec,
  entityBrowserEmbedSpec,
  entityCardSpec,
  entityChangelogSpec,
  entityChartSpec,
  metricSpec,
  entityTableSpec,
  entityViewEmbedSpec,
  entityGraphSpec,
  documentBrowserEmbedSpec,
  entityFieldSpec,
  entityMentionSpec,
  entityLinkSpec,
  labelSpec,
  captionSpec,
  calloutSpec,
  foldableSectionSpec,
  columnsSpec,
  columnSpec,
  tabsSpec,
  tabSpec,
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
  dashboardTabsSpec,
  topEntitiesSpec,
  upcomingByDateSpec,
  upcomingMilestonesSpec,
  wikiPageWidgetSpec
]);
