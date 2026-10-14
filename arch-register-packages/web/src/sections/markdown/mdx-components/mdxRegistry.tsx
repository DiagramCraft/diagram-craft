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
import { METRIC_TYPE } from './blocks/metric/MetricEditable';
import { metricSpec } from './blocks/metric/MetricRegistration';
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
import type { ComponentDefinition, MdxComponentSpec } from './types';
export type { SlashCommandDef, EditorSpec, MdxComponentSpec, DashboardWidgetSpec } from './types';

export const MDX_COMPONENT_DEFINITIONS = {
  [DIAGRAM_EMBED_TYPE]: diagramEmbedSpec,
  [IMAGE_EMBED_TYPE]: imageEmbedSpec,
  [ENTITY_BROWSER_EMBED_TYPE]: entityBrowserEmbedSpec,
  [ENTITY_CARD_TYPE]: entityCardSpec,
  [ENTITY_CHANGELOG_TYPE]: entityChangelogSpec,
  [ENTITY_CHART_TYPE]: entityChartSpec,
  [METRIC_TYPE]: metricSpec,
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
  [TAB_TYPE]: tabSpec
} satisfies Record<string, ComponentDefinition>;

export type MdxComponentName = keyof typeof MDX_COMPONENT_DEFINITIONS;

/** MDX render/editor specs projected from categorized component definitions. */
export const MDX_COMPONENTS = Object.fromEntries(
  Object.values(MDX_COMPONENT_DEFINITIONS).flatMap(definition =>
    definition.mdx ? [[definition.type, definition.mdx] as const] : []
  )
) as Partial<Record<MdxComponentName, MdxComponentSpec>>;

export const getMdxSpec = (name: MdxComponentName): MdxComponentSpec => {
  const spec = MDX_COMPONENTS[name];
  if (!spec) throw new Error(`No MDX component spec registered for "${name}"`);
  return spec;
};

/** Safe accessor for an arbitrary MDX component name. */
export const getMdxSpecSafe = (name: string): MdxComponentSpec | undefined =>
  (MDX_COMPONENTS as Partial<Record<string, MdxComponentSpec>>)[name];

/** MDX specs available on the requested content surface. */
export const getMdxSpecsForSurface = (
  surface: 'wiki' | 'dashboard'
): Record<string, MdxComponentSpec> =>
  Object.fromEntries(
    Object.values(MDX_COMPONENT_DEFINITIONS).flatMap(definition =>
      definition.mdx && definition.surfaces.includes(surface)
        ? [[definition.type, definition.mdx] as const]
        : []
    )
  );
