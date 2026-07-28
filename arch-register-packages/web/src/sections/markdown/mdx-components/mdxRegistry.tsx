import { DIAGRAM_EMBED_TYPE } from './blocks/diagram-embed/DiagramEmbedEditable';
import { diagramEmbedSpec } from './blocks/diagram-embed/DiagramEmbedRegistration';
import { IMAGE_EMBED_TYPE } from './blocks/image-embed/ImageEmbedEditable';
import { imageEmbedSpec } from './blocks/image-embed/ImageEmbedRegistration';
import { ENTITY_BROWSER_EMBED_TYPE } from './blocks/entity-browser-embed/EntityBrowserEmbedEditable';
import { entityBrowserEmbedSpec } from './blocks/entity-browser-embed/EntityBrowserEmbedRegistration';
import { ENTITY_CARD_TYPE } from './blocks/entity-card/EntityCardEditable';
import { entityCardSpec } from './blocks/entity-card/EntityCardRegistration';
import { ENTITY_CHANGELOG_TYPE } from './blocks/entity-changelog/EntityChangelogEditable';
import { entityChangelogSpec } from './blocks/entity-changelog/EntityChangelogRegistration';
import { ENTITY_CHART_TYPE } from './blocks/entity-chart/EntityChartEditable';
import { entityChartSpec } from './blocks/entity-chart/EntityChartRegistration';
import { ENTITY_METRIC_TYPE } from './blocks/entity-metric/EntityMetricEditable';
import { entityMetricSpec } from './blocks/entity-metric/EntityMetricRegistration';
import { ENTITY_TABLE_TYPE } from './blocks/entity-table/EntityTableEditable';
import { entityTableSpec } from './blocks/entity-table/EntityTableRegistration';
import { ENTITY_VIEW_EMBED_TYPE } from './blocks/entity-view-embed/EntityViewEmbedEditable';
import { entityViewEmbedSpec } from './blocks/entity-view-embed/EntityViewEmbedRegistration';
import { ENTITY_GRAPH_TYPE } from './blocks/entity-graph/EntityGraphEditable';
import { entityGraphSpec } from './blocks/entity-graph/EntityGraphRegistration';
import { DOCUMENT_BROWSER_EMBED_TYPE } from './blocks/document-browser-embed/DocumentBrowserEmbedEditable';
import { documentBrowserEmbedSpec } from './blocks/document-browser-embed/DocumentBrowserEmbedRegistration';
import { ENTITY_FIELD_TYPE } from './inlines/entity-field/EntityFieldEditable';
import { entityFieldSpec } from './inlines/entity-field/EntityFieldRegistration';
import { ENTITY_MENTION_TYPE } from './inlines/entity-mention/EntityMentionEditable';
import { entityMentionSpec } from './inlines/entity-mention/EntityMentionRegistration';
import { ENTITY_LINK_TYPE } from './inlines/entity-link/EntityLinkEditable';
import { entityLinkSpec } from './inlines/entity-link/EntityLinkRegistration';
import { LABEL_TYPE } from './inlines/label/LabelEditable';
import { labelSpec } from './inlines/label/LabelRegistration';
import { CAPTION_TYPE } from './blocks/caption/CaptionEditable';
import { captionSpec } from './blocks/caption/CaptionRegistration';
import { CALLOUT_TYPE } from './blocks/callout/CalloutEditable';
import { calloutSpec } from './blocks/callout/CalloutRegistration';
import { FOLDABLE_SECTION_TYPE } from './blocks/foldable-section/FoldableSectionEditable';
import { foldableSectionSpec } from './blocks/foldable-section/FoldableSectionRegistration';
import { COLUMNS_TYPE } from './blocks/columns/ColumnsEditable';
import { columnsSpec } from './blocks/columns/ColumnsRegistration';
import { COLUMN_TYPE } from './blocks/columns/ColumnEditable';
import { columnSpec } from './blocks/columns/ColumnRegistration';
import { TABS_TYPE } from './blocks/tabs/TabsEditable';
import { tabsSpec } from './blocks/tabs/TabsRegistration';
import { TAB_TYPE } from './blocks/tabs/TabEditable';
import { tabSpec } from './blocks/tabs/TabRegistration';
import {
  ENTITY_LIFECYCLE_CHART_TYPE,
  entityLifecycleChartSpec
} from './blocks/entity-lifecycle-chart/EntityLifecycleChartRegistration';
import {
  ENTITY_ACTIVITY_TREND_CHART_TYPE,
  entityActivityTrendChartSpec
} from './blocks/entity-activity-trend-chart/EntityActivityTrendChartRegistration';
import {
  ENTITY_STALE_REPORT_TYPE,
  entityStaleReportSpec
} from './blocks/entity-stale-report/EntityStaleReportRegistration';
import {
  ACTIVITY_FEED_TYPE,
  activityFeedSpec
} from '../../dashboard/widgets/ActivityFeedRegistration';
import {
  ACTIVE_ASSESSMENTS_TYPE,
  activeAssessmentsSpec
} from '../../dashboard/widgets/ActiveAssessmentsRegistration';
import {
  UPCOMING_MILESTONES_TYPE,
  upcomingMilestonesSpec
} from '../../dashboard/widgets/UpcomingMilestonesRegistration';
import type { DashboardWidgetSpec, MdxComponentSpec } from './types';
export type { SlashCommandDef, EditorSpec, MdxComponentSpec, DashboardWidgetSpec } from './types';

export const MDX_COMPONENTS = {
  [DIAGRAM_EMBED_TYPE]: diagramEmbedSpec,
  [IMAGE_EMBED_TYPE]: imageEmbedSpec,
  [ENTITY_BROWSER_EMBED_TYPE]: entityBrowserEmbedSpec,
  [ENTITY_CARD_TYPE]: entityCardSpec,
  [ENTITY_CHANGELOG_TYPE]: entityChangelogSpec,
  [ENTITY_CHART_TYPE]: entityChartSpec,
  [ENTITY_METRIC_TYPE]: entityMetricSpec,
  [ENTITY_TABLE_TYPE]: entityTableSpec,
  [ENTITY_VIEW_EMBED_TYPE]: entityViewEmbedSpec,
  [ENTITY_GRAPH_TYPE]: entityGraphSpec,
  [DOCUMENT_BROWSER_EMBED_TYPE]: documentBrowserEmbedSpec,
  [ENTITY_FIELD_TYPE]: entityFieldSpec,
  [ENTITY_MENTION_TYPE]: entityMentionSpec,
  [ENTITY_LINK_TYPE]: entityLinkSpec,
  [LABEL_TYPE]: labelSpec,
  [CAPTION_TYPE]: captionSpec,
  [CALLOUT_TYPE]: calloutSpec,
  [FOLDABLE_SECTION_TYPE]: foldableSectionSpec,
  [COLUMNS_TYPE]: columnsSpec,
  [COLUMN_TYPE]: columnSpec,
  [TABS_TYPE]: tabsSpec,
  [TAB_TYPE]: tabSpec,
  [ENTITY_LIFECYCLE_CHART_TYPE]: entityLifecycleChartSpec,
  [ENTITY_ACTIVITY_TREND_CHART_TYPE]: entityActivityTrendChartSpec,
  [ENTITY_STALE_REPORT_TYPE]: entityStaleReportSpec,
  [ACTIVITY_FEED_TYPE]: activityFeedSpec,
  [ACTIVE_ASSESSMENTS_TYPE]: activeAssessmentsSpec,
  [UPCOMING_MILESTONES_TYPE]: upcomingMilestonesSpec
} satisfies Record<string, MdxComponentSpec>;

export type MdxComponentName = keyof typeof MDX_COMPONENTS;

/**
 * Typed accessor for a registry entry. `MDX_COMPONENTS[name]` alone resolves to
 * the union of each component's own literal spec type (since `satisfies` doesn't
 * widen), so optional fields not present on every entry (e.g. `acceptsChildren`)
 * aren't visible without this cast.
 */
export const getMdxSpec = (name: MdxComponentName): MdxComponentSpec => MDX_COMPONENTS[name];

/** Safe accessor for an arbitrary, untyped string (e.g. a persisted `widget.type`). */
export const getMdxSpecSafe = (name: string): MdxComponentSpec | undefined =>
  (MDX_COMPONENTS as Record<string, MdxComponentSpec>)[name];

/**
 * A spec is eligible for `'wiki'` when `surfaces` is unset (defaults to wiki-only,
 * matching prior behavior) or explicitly includes `'wiki'`; eligible for `'dashboard'`
 * only when it explicitly opts in via `surfaces`.
 */
const isEligibleForSurface = (spec: MdxComponentSpec, surface: 'wiki' | 'dashboard'): boolean =>
  surface === 'wiki'
    ? spec.surfaces === undefined || spec.surfaces.includes('wiki')
    : !!spec.surfaces?.includes('dashboard');

/**
 * Filters the registry by rendering surface: wiki sees components that are
 * wiki-eligible (`surfaces` unset or including `'wiki'`); dashboard sees only
 * components that explicitly opt in via `spec.surfaces`.
 */
export const getMdxSpecsForSurface = (
  surface: 'wiki' | 'dashboard'
): Record<string, MdxComponentSpec> =>
  Object.fromEntries(
    Object.entries(MDX_COMPONENTS).filter(([, spec]) => isEligibleForSurface(spec, surface))
  );

/**
 * Every `MDX_COMPONENTS` key that carries a `dashboardWidget` block, i.e. every
 * type addable to a dashboard. `defineMdxComponent` erases each registration to
 * the common `MdxComponentSpec` type, so this can't be derived structurally from
 * `typeof MDX_COMPONENTS` — it's a union of the same `_TYPE` consts used as the
 * map's keys above. Registering a new dashboard widget means adding it here and
 * to `MDX_COMPONENTS`, both in this one file.
 */
export type KnownWidgetType =
  | typeof ENTITY_METRIC_TYPE
  | typeof ENTITY_VIEW_EMBED_TYPE
  | typeof ENTITY_TABLE_TYPE
  | typeof ENTITY_LIFECYCLE_CHART_TYPE
  | typeof ENTITY_ACTIVITY_TREND_CHART_TYPE
  | typeof ENTITY_STALE_REPORT_TYPE
  | typeof ACTIVITY_FEED_TYPE
  | typeof ACTIVE_ASSESSMENTS_TYPE
  | typeof UPCOMING_MILESTONES_TYPE;

export const isKnownWidgetType = (type: string): type is KnownWidgetType =>
  !!getMdxSpecSafe(type)?.dashboardWidget;

/** All dashboard-widget specs in the registry, keyed by their MDX type. */
export const getDashboardWidgetSpecs = (): Array<{
  type: KnownWidgetType;
  spec: DashboardWidgetSpec;
}> =>
  Object.entries(MDX_COMPONENTS)
    .filter((entry): entry is [string, MdxComponentSpec] => !!entry[1].dashboardWidget)
    .map(([type, spec]) => ({ type: type as KnownWidgetType, spec: spec.dashboardWidget! }));

/** Looks up a single dashboard-widget spec by type, if it has one. */
export const getDashboardWidgetSpec = (type: string): DashboardWidgetSpec | undefined =>
  getMdxSpecSafe(type)?.dashboardWidget;
