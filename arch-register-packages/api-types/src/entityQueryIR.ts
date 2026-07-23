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
  | { kind: 'backward'; fieldId: string; ownerSchemaId: string; filter?: QueryNode };

export type QueryNode =
  | { kind: 'and'; children: QueryNode[] }
  | { kind: 'or'; children: QueryNode[] }
  | { kind: 'not'; child: QueryNode }
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
    })
  ])
);

export type ProjectionField = {
  path: PathStep[];
  fieldId: string;
  alias?: string;
};

export const projectionFieldSchema = z.object({
  path: z.array(pathStepSchema),
  fieldId: z.string(),
  alias: z.string().min(1).optional()
});

export const queryNodeSchema: z.ZodType<QueryNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('and'), children: z.array(queryNodeSchema) }),
    z.object({ kind: z.literal('or'), children: z.array(queryNodeSchema) }),
    z.object({ kind: z.literal('not'), child: queryNodeSchema }),
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
  includeProjectSnapshots: z.boolean().optional(),
  projections: z.array(projectionFieldSchema).optional(),
  root: queryNodeSchema
});

export type EntityQuery = z.infer<typeof entityQuerySchema>;
