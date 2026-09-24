import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import { MAX_PATH_HOPS, pathStepSchema } from '@arch-register/api-types/entityQueryIR';

// ── Blast-radius entry point (#3358, part of #2979) ────────────
//
// Normalizes a subject reference (entity, relation instance, or change case) into one or more
// entity roots and runs the existing bounded, permission-aware traversal engine
// (server/src/domain/catalog/entityTraversal.ts) against them. Ranking/grouping, planned-change
// diffing, and UI surfacing are separate follow-up issues (#3359-#3362); this endpoint is only
// the entry point.

export const entityTraversalSubjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('entity'), entityId: z.string() }).describe('Start from an entity'),
  z
    .object({ kind: z.literal('relation'), relationId: z.string() })
    .describe('Start from both endpoints of a relation instance'),
  z
    .object({ kind: z.literal('changeCase'), caseId: z.string() })
    .describe("Start from the entities/relations touched by a change case's active revision")
]);
export type EntityTraversalSubject = z.infer<typeof entityTraversalSubjectSchema>;

const entityTraversalPathInputSchema = z.object({
  id: z.string().describe('Caller-assigned identifier correlating results back to this path'),
  steps: z.array(pathStepSchema).min(1).max(MAX_PATH_HOPS).describe('Ordered traversal hops')
});

const entityTraversalRequestSchema = z.object({
  subject: entityTraversalSubjectSchema,
  paths: z.array(entityTraversalPathInputSchema).min(1),
  maxDepth: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional()
    .describe('Overrides the default max traversal depth'),
  maxNodes: z
    .number()
    .int()
    .min(1)
    .max(100_000)
    .optional()
    .describe('Overrides the default max traversed node count')
});

const entityTraversalGraphNodeSchema = z.object({
  context: z.enum(['entity', 'relation']),
  id: z.string(),
  schemaId: z.string()
});

const entityTraversalGraphPathSchema = z.object({
  pathId: z.string().nullable(),
  hops: z.array(entityTraversalGraphNodeSchema)
});

const entityTraversalGraphNodeChangeSchema = z.object({
  node: entityTraversalGraphNodeSchema,
  path: entityTraversalGraphPathSchema
});

const entityTraversalGraphEdgeSchema = z.object({
  pathId: z.string(),
  stepIndex: z.number().int().min(0),
  from: entityTraversalGraphNodeSchema,
  to: entityTraversalGraphNodeSchema
});

const entityTraversalGraphDiffRequestSchema = entityTraversalRequestSchema.extend({
  candidateCaseId: z
    .string()
    .optional()
    .describe(
      'Candidate planned-change case. Defaults to the subject case when the subject kind is changeCase.'
    )
});

const entityTraversalGraphDiffResponseSchema = z.object({
  nodes: z.object({
    added: z.array(entityTraversalGraphNodeChangeSchema),
    removed: z.array(entityTraversalGraphNodeChangeSchema),
    pathChanged: z.array(
      z.object({
        node: entityTraversalGraphNodeSchema,
        beforePath: entityTraversalGraphPathSchema,
        afterPath: entityTraversalGraphPathSchema
      })
    )
  }),
  edges: z.object({
    added: z.array(entityTraversalGraphEdgeSchema),
    removed: z.array(entityTraversalGraphEdgeSchema)
  })
});

const entityTraversalHopSchema = z.object({
  context: z.enum(['entity', 'relation']),
  id: z.string(),
  schemaId: z.string()
});

const entityTraversalTerminalSchema = z.object({
  context: z.enum(['entity', 'relation']),
  id: z.string(),
  schemaId: z.string(),
  source: z.record(z.string(), z.unknown())
});

const entityTraversalOccurrenceSchema = z.object({
  rootId: z.string(),
  pathId: z.string(),
  terminal: entityTraversalTerminalSchema,
  provenance: z.array(entityTraversalHopSchema)
});

const entityTraversalPathResultSchema = z.object({
  pathId: z.string(),
  occurrences: z.array(entityTraversalOccurrenceSchema),
  distinctTerminals: z.array(entityTraversalTerminalSchema),
  duplicateCount: z.number().int().min(0),
  cycleDetected: z.boolean()
});

const entityTraversalRootResultSchema = z.object({
  rootId: z.string(),
  paths: z.array(entityTraversalPathResultSchema)
});

const entityTraversalResultSchema = z.object({
  roots: z.array(entityTraversalRootResultSchema)
});

export const workspaceEntityTraversalContract = oc.tag('EntityTraversal').router({
  entityTraversal: {
    traverse: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/traverse',
        inputStructure: 'detailed',
        summary: 'Run a bounded, permission-aware traversal from a subject',
        description:
          'Normalizes a subject reference (entity, relation instance, or change case) into one ' +
          'or more entity roots and traverses the requested paths from those roots.',
        tags: ['EntityTraversal']
      })
      .input(
        z.object({
          params: ws,
          body: entityTraversalRequestSchema
        })
      )
      .output(entityTraversalResultSchema),
    diff: oc
      .route({
        method: 'POST',
        path: '/{workspace}/data/traverse/diff',
        inputStructure: 'detailed',
        summary: 'Compare reachable graphs with a planned change applied',
        description:
          'Returns added and removed reachable nodes and edges between live state and the active ' +
          'revision of a selected planned-change case, including canonical paths for changed nodes.',
        tags: ['EntityTraversal']
      })
      .input(
        z.object({
          params: ws,
          body: entityTraversalGraphDiffRequestSchema
        })
      )
      .output(entityTraversalGraphDiffResponseSchema)
  }
});

export type EntityTraversalGraphDiffRequest = z.infer<typeof entityTraversalGraphDiffRequestSchema>;
export type EntityTraversalGraphDiffResponse = z.infer<
  typeof entityTraversalGraphDiffResponseSchema
>;
