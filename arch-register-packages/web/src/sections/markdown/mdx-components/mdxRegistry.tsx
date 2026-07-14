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
import { ENTITY_FIELD_TYPE } from './inlines/entity-field/EntityFieldEditable';
import { entityFieldSpec } from './inlines/entity-field/EntityFieldRegistration';
import { ENTITY_MENTION_TYPE } from './inlines/entity-mention/EntityMentionEditable';
import { entityMentionSpec } from './inlines/entity-mention/EntityMentionRegistration';
import { ENTITY_LINK_TYPE } from './inlines/entity-link/EntityLinkEditable';
import { entityLinkSpec } from './inlines/entity-link/EntityLinkRegistration';
import { CAPTION_TYPE } from './blocks/caption/CaptionEditable';
import { captionSpec } from './blocks/caption/CaptionRegistration';
import type { MdxComponentSpec } from './types';
export type { SlashCommandDef, EditorSpec, MdxComponentSpec } from './types';

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
  [ENTITY_FIELD_TYPE]: entityFieldSpec,
  [ENTITY_MENTION_TYPE]: entityMentionSpec,
  [ENTITY_LINK_TYPE]: entityLinkSpec,
  [CAPTION_TYPE]: captionSpec
} satisfies Record<string, MdxComponentSpec>;

export type MdxComponentName = keyof typeof MDX_COMPONENTS;

/**
 * Typed accessor for a registry entry. `MDX_COMPONENTS[name]` alone resolves to
 * the union of each component's own literal spec type (since `satisfies` doesn't
 * widen), so optional fields not present on every entry (e.g. `acceptsChildren`)
 * aren't visible without this cast.
 */
export const getMdxSpec = (name: MdxComponentName): MdxComponentSpec => MDX_COMPONENTS[name];
