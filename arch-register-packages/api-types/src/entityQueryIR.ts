import { z } from 'zod';
import { filterOpSchema, type FilterOp } from '@arch-register/api-types/filterOp';

export type { FilterOp } from '@arch-register/api-types/filterOp';

// Structured intermediate representation for the entity query language (specs/QUERY_LANGUAGE.md, §5).
// The text grammar (not implemented yet) compiles to/from this shape; today's flat `FilterCondition[]`
// is the degenerate case (see entityQueryIRMapping.ts in the server package).

// Cap on PathStep chain length (specs/QUERY_LANGUAGE.md §7), counted cumulatively including hops
// nested inside a PathStep.filter's own paths. Bounds join fan-out; there's no recursion to bound.
export const MAX_PATH_HOPS = 6;

export type PathStep =
  | { kind: 'forward'; fieldId: string; filter?: QueryNode }
  | { kind: 'backward'; fieldId: string; ownerSchemaId: string; filter?: QueryNode }
  | {
      kind: 'typedRelation';
      fieldId: string;
      relationSchemaId: string;
      direction: 'in' | 'out';
      /** Entity schemas whose viewable typed-relation field granted this hop. */
      ownerSchemaIds: string[];
      filter?: QueryNode;
    }
  | {
      // Relation -> its `in`/`out` entity endpoint. Only legal at a position in the path that is
      // currently on a relation row: `path[0]` of a relation-rooted query/`relationExists` path,
      // `path[0]` inside a `typedRelation`/`relationBackward` step's `filter`, or immediately
      // after a `relationBackward` step. Every subsequent step is an ordinary
      // forward/backward/typedRelation step over the resulting entity. Unlike `typedRelation`
      // there's exactly one entity per direction, so no owner-schema/fan-out bookkeeping is needed.
      kind: 'endpoint';
      direction: 'in' | 'out';
    }
  | {
      // Relation -> entity via one of the relation schema's own `entityRelation` fields (#2670).
      // Legal wherever `endpoint` is legal (see above) — the current path position must be a
      // relation row. Unlike `endpoint`'s fixed in/out slot, this names an arbitrary declared
      // field, and its target may be multi-valued (see relationIsMultiValued in the compiler).
      kind: 'relationForward';
      fieldId: string;
      filter?: QueryNode;
    }
  | {
      // Entity -> relation via another relation schema's `entityRelation` field that points back
      // at the current entity's schema (#2670). Mirrors `backward`, but resolves `fieldId` against
      // the relation-schema registry (via `relationSchemaId`) rather than the entity-schema
      // registry, and lands on relation context rather than entity context — so a following step
      // may be `endpoint`, `relationForward`, or another `relationBackward`.
      kind: 'relationBackward';
      fieldId: string;
      relationSchemaId: string;
      filter?: QueryNode;
    };

export type QueryNode =
  | { kind: 'and'; children: QueryNode[] }
  | { kind: 'or'; children: QueryNode[] }
  | { kind: 'not'; child: QueryNode }
  // Root-entity free-text search. This is intentionally not a field predicate: it may only
  // appear in the root query tree, never inside a relation path's scoped filter.
  | { kind: 'freeText'; value: string }
  | { kind: 'predicate'; path: PathStep[]; fieldId: string; op: FilterOp; value: unknown }
  | { kind: 'relationExists'; path: PathStep[] };

export const pathStepSchema: z.ZodType<PathStep> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('forward'),
      fieldId: z.string(),
      filter: queryNodeSchema.optional()
    }),
    z.object({
      kind: z.literal('backward'),
      fieldId: z.string(),
      // Always resolved in the IR: the text compiler resolves an explicit `<-Schema.field`
      // qualifier, or the single owning schema for a bare `<-field`, at parse time. A valid IR
      // never carries an unresolved/ambiguous backward step.
      ownerSchemaId: z.string(),
      filter: queryNodeSchema.optional()
    }),
    z.object({
      kind: z.literal('typedRelation'),
      fieldId: z.string(),
      relationSchemaId: z.string(),
      direction: z.enum(['in', 'out']),
      ownerSchemaIds: z.array(z.string()).min(1),
      filter: queryNodeSchema.optional()
    }),
    z.object({
      kind: z.literal('endpoint'),
      direction: z.enum(['in', 'out'])
    }),
    z.object({
      kind: z.literal('relationForward'),
      fieldId: z.string(),
      filter: queryNodeSchema.optional()
    }),
    z.object({
      kind: z.literal('relationBackward'),
      fieldId: z.string(),
      relationSchemaId: z.string(),
      filter: queryNodeSchema.optional()
    })
  ])
);

export type ProjectionField = {
  path: PathStep[];
  fieldId: string;
  /** Defaults to the entity at the end of `path`; `relation` reads the matching relation row. */
  source?: 'entity' | 'relation';
  alias?: string;
};

export const projectionFieldSchema = z.object({
  path: z.array(pathStepSchema),
  fieldId: z.string(),
  source: z.enum(['entity', 'relation']).optional(),
  alias: z.string().min(1).optional()
});

export const queryNodeSchema: z.ZodType<QueryNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('and'), children: z.array(queryNodeSchema) }),
    z.object({ kind: z.literal('or'), children: z.array(queryNodeSchema) }),
    z.object({ kind: z.literal('not'), child: queryNodeSchema }),
    z.object({ kind: z.literal('freeText'), value: z.string() }),
    z.object({
      kind: z.literal('predicate'),
      path: z.array(pathStepSchema),
      fieldId: z.string(),
      op: filterOpSchema,
      value: z.unknown()
    }),
    z.object({ kind: z.literal('relationExists'), path: z.array(pathStepSchema) })
  ])
);

// Root query shape. `schemaId`/`assessmentId` are top-level, non-tree fields — independent of any
// `_schemaId` predicate that may also appear in `root`, and (for `assessmentId`) supplied by the
// query execution context rather than query text (specs/QUERY_LANGUAGE.md §4.4, §4.5).
//
export const entityQuerySchema = z.object({
  // Which catalog-record kind the query is rooted at. Usually left unset: when `schemaId` is
  // present, the root kind is derived by resolving it against the entity/relation schema
  // registries (entity and relation schemas live in disjoint id spaces), so callers building a
  // schema-scoped relation query never need to set this explicitly. It only matters as an
  // explicit fallback for the schema-less "browse everything" case, where it defaults to
  // 'entity' for backward compatibility with pre-existing queries and saved views. If both
  // `schemaId` and `root_kind` are supplied and disagree with the schema lookup, that's a
  // validation error, not a silent override.
  root_kind: z.enum(['entity', 'relation']).optional(),
  schemaId: z.string().optional(),
  assessmentId: z.string().optional(),
  projectId: z.string().optional(),
  projectScope: z
    .enum(['project', 'all'])
    .optional()
    .describe(
      'Project mode includes project-owned or project_entity-linked entities; all mode includes global entities and entities owned by the selected project'
    ),
  asOf: z
    .string()
    .refine(value => !Number.isNaN(Date.parse(value)), 'Invalid asOf date')
    .optional(),
  includePlannedChanges: z.boolean().optional(),
  projections: z.array(projectionFieldSchema).optional(),
  root: queryNodeSchema
});

export type EntityQuery = z.infer<typeof entityQuerySchema>;
