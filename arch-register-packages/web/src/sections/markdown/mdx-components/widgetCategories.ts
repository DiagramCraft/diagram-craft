export type WidgetCategory = 'metrics' | 'data-views' | 'visualizations' | 'content-layout';

export const WIDGET_CATEGORIES: ReadonlyArray<{
  id: WidgetCategory;
  label: string;
  description: string;
}> = [
  { id: 'metrics', label: 'Metrics', description: 'Single numbers and counts at a glance' },
  { id: 'data-views', label: 'Data views', description: 'Tables, lists and queues of records' },
  {
    id: 'visualizations',
    label: 'Visualizations',
    description: 'Charts, graphs, calendars and diagrams'
  },
  {
    id: 'content-layout',
    label: 'Content & layout',
    description: 'Text, media and ways to arrange other widgets'
  }
];

/**
 * User-facing category per widget type (the key used in MDX_COMPONENTS, or the
 * dashboard-only widget type). Kept central so the groupings can be reviewed and
 * tuned in one place; a registry test fails when a registered widget is missing.
 */
export const WIDGET_CATEGORY_BY_TYPE: Readonly<Record<string, WidgetCategory>> = {
  // Metrics
  Metric: 'metrics',
  AggregateStat: 'metrics',
  AssessmentStatusStat: 'metrics',
  AssessmentCount: 'metrics',
  Assessments: 'metrics',
  CountByField: 'metrics',
  RatioBarList: 'metrics',
  'upcoming-milestones': 'metrics',
  EntityField: 'metrics',
  'api-integration-catalog-stats': 'metrics',
  'api-integration-catalog-needs-attention-count': 'metrics',
  'data-stewardship-case-count': 'metrics',
  'data-stewardship-reviews-overdue': 'metrics',

  // Data views
  EntityTable: 'data-views',
  EntityBrowserEmbed: 'data-views',
  EntityViewEmbed: 'data-views',
  DocumentBrowserEmbed: 'data-views',
  EntityCard: 'data-views',
  EntityChangelog: 'data-views',
  EntityMention: 'data-views',
  EntityLink: 'data-views',
  'activity-feed': 'data-views',
  'entity-stale-report': 'data-views',
  'conformance-violation-summary': 'data-views',
  ConformanceViolations: 'data-views',
  NeedsAttentionQueue: 'data-views',
  AssessmentProgressTable: 'data-views',
  ChangeCaseTable: 'data-views',
  GroupedRollupTable: 'data-views',
  FieldMatrix: 'data-views',
  RelationTable: 'data-views',
  RelationPairsCoverage: 'data-views',
  RelatedEntitiesList: 'data-views',
  PathWalker: 'data-views',
  SpecItemsTable: 'data-views',
  TopEntities: 'data-views',
  UpcomingByDate: 'data-views',
  'api-integration-catalog-pair-gaps': 'data-views',
  'api-integration-catalog-needs-attention': 'data-views',
  'api-integration-catalog-most-consumed': 'data-views',
  'api-integration-catalog-at-risk': 'data-views',
  'data-stewardship-case-queue': 'data-views',

  // Visualizations
  EntityChart: 'visualizations',
  EntityGraph: 'visualizations',
  DiagramEmbed: 'visualizations',
  'entity-lifecycle-chart': 'visualizations',
  'entity-activity-trend-chart': 'visualizations',
  DateBucketChart: 'visualizations',
  DateCalendar: 'visualizations',
  DateRangeTimeline: 'visualizations',
  'blast-radius': 'visualizations',
  'risk-compliance-risk-matrix': 'visualizations',
  'api-integration-catalog-impact': 'visualizations',
  'data-stewardship-case-calendar': 'visualizations',

  // Content & layout
  markdown: 'content-layout',
  'wiki-page': 'content-layout',
  tabs: 'content-layout',
  Tabs: 'content-layout',
  Columns: 'content-layout',
  Callout: 'content-layout',
  FoldableSection: 'content-layout',
  Caption: 'content-layout',
  ImageEmbed: 'content-layout',
  Label: 'content-layout'
};

export const getWidgetCategory = (type: string): WidgetCategory =>
  WIDGET_CATEGORY_BY_TYPE[type] ?? 'content-layout';

type Categorized<T> = { category: WidgetCategory; items: T[] };

/** Groups items by category in display order, dropping empty categories. */
export const groupByCategory = <T>(
  items: ReadonlyArray<T>,
  categoryOf: (item: T) => WidgetCategory
): Array<Categorized<T> & { label: string; description: string }> =>
  WIDGET_CATEGORIES.flatMap(c => {
    const inCategory = items.filter(item => categoryOf(item) === c.id);
    return inCategory.length === 0
      ? []
      : [{ category: c.id, label: c.label, description: c.description, items: inCategory }];
  });

/** Case-insensitive match on label, description and optional keywords. */
export const matchesWidgetSearch = (
  query: string,
  entry: { label: string; description: string; keywords?: string[] }
): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    entry.label.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    (entry.keywords?.some(k => k.toLowerCase().includes(q)) ?? false)
  );
};
