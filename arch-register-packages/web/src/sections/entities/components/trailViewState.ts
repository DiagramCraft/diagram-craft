import type { EntityQuery, PathStep } from '@arch-register/api-types/entityQueryIR';
import {
  pathWalkerViewConfigSchema,
  type PathWalkerViewConfig
} from '@arch-register/api-types/viewContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import {
  addIncludePathProjection,
  decodeIncludePathProjection,
  pathStepKey as pathStepKeyImpl,
  pathStepOptions,
  type PathStepOption
} from './pathBuilder/pathBuilderState';

export const pathStepKey = pathStepKeyImpl;

/** Alias for the single-hop `includePath` projection each column attaches to its lookup query. */
export const PATH_WALKER_PROJECTION_ALIAS = '__path_walker__:hop';

export const parsePathWalkerConfig = (config: unknown): PathWalkerViewConfig | null => {
  const result = pathWalkerViewConfigSchema.safeParse(config);
  return result.success ? result.data : null;
};

export const pathWalkerHops = (config: unknown): PathStep[] =>
  parsePathWalkerConfig(config)?.hops ?? [];

/** Which in/out direction glyph a step reads as, matching the hop editor's `→` (self-owned /
 *  outward) vs `←` (reverse-lookup / inward) convention. */
export const hopDirectionGlyph = (step: PathStep): '→' | '←' => {
  switch (step.kind) {
    case 'forward':
      return '→';
    case 'backward':
      return '←';
    case 'typedRelation':
    case 'unboundTypedRelation':
      return step.direction === 'in' ? '→' : '←';
    default:
      return '→';
  }
};

const GROUP_RANK: Record<string, number> = {
  Containment: 0,
  Reference: 1,
  'Typed relation': 2,
  Relation: 3
};

/** Every hop that can be traversed from a single entity of `schemaId`, both directions merged and
 *  de-duplicated, ordered by hop-kind group then label - the option list behind an arrow's
 *  "which relation to follow" dropdown. */
export const hopOptionsFrom = ({
  schemaId,
  schemas,
  relationSchemas,
  getFieldGroupAccess
}: {
  schemaId: string;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
}): PathStepOption[] => {
  const scope = [schemaId];
  const byKey = new Map<string, PathStepOption>();
  for (const direction of ['out', 'in'] as const) {
    for (const option of pathStepOptions({
      direction,
      currentSchemaScope: scope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    })) {
      const key = pathStepKey(option.step);
      if (!byKey.has(key)) byKey.set(key, option);
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      (GROUP_RANK[a.group] ?? 9) - (GROUP_RANK[b.group] ?? 9) || a.label.localeCompare(b.label)
  );
};

/** A lookup query that resolves one hop out from one or more source entities: filter roots to
 *  those ids, then attach a correlated single-step `includePath` projection so each result row
 *  carries the entities reachable from it by `hop`. Mirrors `buildTraceabilityEntityQuery`. */
export const buildHopColumnQuery = (fromEntityIds: string | string[], hop: PathStep): EntityQuery =>
  addIncludePathProjection(
    {
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_id',
        op: 'in',
        value: Array.isArray(fromEntityIds) ? fromEntityIds : [fromEntityIds]
      }
    },
    [hop],
    PATH_WALKER_PROJECTION_ALIAS
  );

export type HopColumnNode = { id: string; name: string; schemaId: string };

/** Decodes the single-hop `includePath` projection on the looked-up root row into the distinct set
 *  of entities reached by the hop, sorted by name. */
export const decodeHopColumnNodes = (projectionValue: unknown): HopColumnNode[] => {
  const seen = new Map<string, HopColumnNode>();
  for (const includedPath of decodeIncludePathProjection(projectionValue)) {
    const leaf = includedPath[includedPath.length - 1];
    if (leaf && !seen.has(leaf.id)) seen.set(leaf.id, leaf);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
};
