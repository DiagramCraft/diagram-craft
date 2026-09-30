import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { BrowserViewConfigMap } from '../../../../entities/components/entityBrowserState';
import {
  parseViewConfigs,
  serializeViewConfigs
} from '../../../../entities/components/entityBrowserState';

export type EntityBrowserEmbedConfig = {
  q: string;
  conditions: FilterCondition[];
  sort: string;
  view: BrowserView;
  viewConfigs: BrowserViewConfigMap;
  projectScope?: 'project' | 'all';
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
  entityQuery?: EntityQuery;
  /**
   * Schema display NAME to scope the browser to, resolved to a schema id at render time (mirrors
   * `dashboardSidebarConfigSchema.schemaName`) — for a seeded, cross-workspace config, where the
   * actual schema id isn't stable. Takes effect alongside (not instead of) any `_schemaId`
   * condition already in `conditions`. Not authorable via the embed's own config form yet.
   */
  schemaName?: string;
};

const toBase64Url = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeEntityBrowserEmbedConfig = (config: EntityBrowserEmbedConfig): string => {
  const payload = {
    q: config.q,
    conditions: config.conditions,
    sort: config.sort,
    view: config.view,
    viewConfigs: serializeViewConfigs(config.viewConfigs),
    projectScope: config.projectScope,
    entityQuery: config.entityQuery,
    schemaName: config.schemaName
  };
  return toBase64Url(JSON.stringify(payload));
};

export const decodeEntityBrowserEmbedConfig = (
  raw: string | undefined
): EntityBrowserEmbedConfig | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>;
    if (parsed == null || typeof parsed !== 'object') return null;
    return {
      q: typeof parsed.q === 'string' ? parsed.q : '',
      conditions: Array.isArray(parsed.conditions) ? (parsed.conditions as FilterCondition[]) : [],
      sort: typeof parsed.sort === 'string' ? parsed.sort : 'name',
      view: (typeof parsed.view === 'string' ? parsed.view : 'table') as BrowserView,
      viewConfigs: parseViewConfigs(
        typeof parsed.viewConfigs === 'string' ? parsed.viewConfigs : undefined
      ),
      projectScope:
        parsed.projectScope === 'project' || parsed.projectScope === 'all'
          ? parsed.projectScope
          : undefined,
      entityQuery:
        parsed.entityQuery != null && typeof parsed.entityQuery === 'object'
          ? (parsed.entityQuery as EntityQuery)
          : undefined,
      schemaName: typeof parsed.schemaName === 'string' ? parsed.schemaName : undefined
    };
  } catch {
    return null;
  }
};
