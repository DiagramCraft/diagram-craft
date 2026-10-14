import { z } from 'zod';
import { metricColourBandSchema, type MetricConfig } from '@arch-register/api-types/metricContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RenderTreeNode } from './mapViewTraversal';

/**
 * A selectable heat overlay for the Map view: a labelled metric (normally carrying
 * `colourBands`) the viewer can switch between at runtime, instead of the map's single saved
 * `metricConfig`.
 */
export type MapOverlay = {
  id: string;
  label: string;
  metricConfig: MetricConfig;
};

export const NO_OVERLAY_ID = 'none';

/**
 * A heat overlay as authored in a widget's config: a numeric field of the map's schema, rolled
 * up over each box's subtree and drawn in severity bands (`max: null` = open top band, bands
 * evaluated low-to-high). `fieldId` is a field NAME or id; a seeded, cross-workspace config
 * uses the name.
 */
export const mapOverlayConfigSchema = z.object({
  fieldId: z.string().min(1),
  label: z.string().optional(),
  aggregation: z.enum(['average', 'sum', 'minimum', 'maximum']),
  colourBands: z.array(metricColourBandSchema)
});

export type MapOverlayConfig = z.infer<typeof mapOverlayConfigSchema>;

export const isMapOverlayConfig = (value: unknown): value is MapOverlayConfig =>
  mapOverlayConfigSchema.safeParse(value).success;

/** Resolves authored overlays against the map's `schema`, dropping those naming no such field. */
export const resolveMapOverlays = (
  overlays: readonly MapOverlayConfig[] | undefined,
  schema: EntitySchema | undefined
): MapOverlay[] | undefined => {
  if (!overlays?.length || !schema) return undefined;
  return overlays.flatMap(overlay => {
    const field = schema.fields.find(
      candidate => candidate.name === overlay.fieldId || candidate.id === overlay.fieldId
    );
    if (!field) return [];
    return [
      {
        id: field.id,
        label: overlay.label ?? field.name,
        metricConfig: {
          sourceSchemaId: schema.id,
          source: { kind: 'field' as const, fieldId: field.id },
          aggregation: overlay.aggregation,
          colourBands: overlay.colourBands
        }
      }
    ];
  });
};

const ownerIdOf = (node: unknown): string | null => {
  const owner = (node as { _owner?: unknown })._owner;
  if (owner == null) return null;
  if (typeof owner === 'string') return owner;
  const id = (owner as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
};

/**
 * The uids of the boxes that stay un-dimmed under a find-as-you-type search and an owner filter,
 * or `null` when neither is active (nothing is dimmed). Non-matching boxes stay in place, dimmed,
 * so the map keeps its structure.
 */
export const computeHighlightedIds = (
  tree: RenderTreeNode[],
  search: string,
  ownerIds: readonly string[] | undefined
): Set<string> | null => {
  const needle = search.trim().toLowerCase();
  const owners = ownerIds ?? [];
  if (!needle && owners.length === 0) return null;
  const ids = new Set<string>();
  const visit = (entry: RenderTreeNode) => {
    const name = String(
      (entry.node as { _name?: unknown })._name ?? (entry.node as { _slug?: unknown })._slug ?? ''
    ).toLowerCase();
    const ownerId = ownerIdOf(entry.node);
    if (
      (owners.length === 0 || (ownerId != null && owners.includes(ownerId))) &&
      (!needle || name.includes(needle))
    ) {
      ids.add(entry.node._uid);
    }
    entry.children.forEach(visit);
  };
  tree.forEach(visit);
  return ids;
};
