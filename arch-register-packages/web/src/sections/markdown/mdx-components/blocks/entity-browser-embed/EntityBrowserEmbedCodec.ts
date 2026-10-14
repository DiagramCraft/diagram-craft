import { z } from 'zod';
import { browserViewSchema, filterConditionSchema } from '@arch-register/api-types/viewContract';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { mapOverlayConfigSchema } from '../../../../entities/components/mapOverlays';
import {
  parseViewConfigs,
  serializeViewConfigs
} from '../../../../entities/components/entityBrowserState';
import { createBlobConfigCodec, withInitial } from '../../configSchema';

export const entityBrowserEmbedConfigSchema = z.object({
  q: withInitial(z.string(), ''),
  conditions: withInitial(z.array(filterConditionSchema), () => []),
  sort: withInitial(z.string(), 'name'),
  view: withInitial(browserViewSchema, 'table'),
  /** Per-view settings, keyed by view; each view validates its own shape when rendered. */
  viewConfigs: withInitial(z.partialRecord(browserViewSchema, z.unknown()), () => ({})),
  projectScope: z.enum(['project', 'all']).optional(),
  /**
   * An advanced, structured query (the same `EntityQuery` shape saved views store — filter tree,
   * relation-path conditions, and projected columns) alongside the embed's "Basic" `conditions`/`q`
   * mode, mirroring saved views' own Basic/Advanced duality (`isBasicRepresentable` et al. in
   * `entityBrowserState.ts`). Authorable via the config form's Advanced filter mode, or set by
   * callers building a config programmatically (e.g. a seeded dashboard widget), where it's the only
   * way to express something `conditions` can't (e.g. "has a category in this set", via
   * `relationExists`). Every field NAME (not id — a schema's actual field ids are workspace-specific)
   * appearing as a single forward-hop `path[0].fieldId`, or as a `path`-less `fieldId` not starting
   * with `_`, is resolved against the relevant schema at render time, mirroring `schemaName` below;
   * deeper multi-hop paths are used as-is (assumed to already carry real ids). Takes effect instead
   * of the `conditions`-built query when present; `q` still applies as live free-text search on top.
   */
  entityQuery: entityQuerySchema.optional(),
  /**
   * Schema display NAME to scope the browser to, resolved to a schema id at render time (mirrors
   * `dashboardSidebarConfigSchema.schemaName`) — for a seeded, cross-workspace config, where the
   * actual schema id isn't stable. Takes effect alongside (not instead of) any `_schemaId`
   * condition already in `conditions`. Not authorable via the embed's own config form yet.
   */
  schemaName: z.string().optional(),
  /** Shows at most this many rows (after sorting). Unset shows all matching rows. */
  limit: z.number().int().positive().optional(),
  /** Opt-in: shows a search box and real pagination (table and cards views). Unset keeps the
   *  static published rendering used by wiki embeds; `limit` is ignored when set. */
  interactive: z.boolean().optional(),
  /** Map view only: the heat overlays the viewer can switch between (with find-as-you-type
   *  search), each a numeric field of the map's schema rolled up and drawn in severity bands.
   *  Edited as JSON in the config form's Advanced section. */
  overlays: z.array(mapOverlayConfigSchema).optional(),
  /** Map view only: boxes whose owner isn't in this list are dimmed; typically
   *  `['$owners']`, a dashboard sidebar variable. Edited in the Advanced section. */
  dimOwnerIds: z.array(z.string()).optional()
});

export type EntityBrowserEmbedConfig = z.infer<typeof entityBrowserEmbedConfigSchema>;

/** The config keys edited as JSON in the config form's Advanced section — everything that has no
 *  dedicated control. */
export const ADVANCED_CONFIG_KEYS = ['overlays', 'dimOwnerIds'] as const;

export const entityBrowserEmbedCodec = createBlobConfigCodec(entityBrowserEmbedConfigSchema, {
  // The per-view settings travel as one JSON string so the attribute stays compact.
  preDecode: payload => ({
    ...payload,
    viewConfigs:
      typeof payload.viewConfigs === 'string' ? parseViewConfigs(payload.viewConfigs) : undefined
  }),
  postEncode: config => ({ ...config, viewConfigs: serializeViewConfigs(config.viewConfigs) })
});

export const {
  createDefault: createDefaultEntityBrowserEmbedConfig,
  encode: encodeEntityBrowserEmbedConfig,
  decode: decodeEntityBrowserEmbedConfig
} = entityBrowserEmbedCodec;
