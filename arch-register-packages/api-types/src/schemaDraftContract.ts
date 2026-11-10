import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

export const schemaDraftKindSchema = z
  .enum(['entity_schema', 'relation_schema', 'document_type', 'enum', 'field_group', 'category'])
  .describe('Kind of schema definition a draft item changes');

export const schemaDraftOpSchema = z
  .enum(['create', 'update', 'delete'])
  .describe('Operation the draft item applies on publish');

export const schemaChangeModeSchema = z
  .enum(['direct', 'draft'])
  .describe('Whether schema edits go live immediately (direct) or must be staged in the draft');

const expectedRevisionSchema = z
  .number()
  .int()
  .min(0)
  .describe('Draft revision the caller last saw; 0 when no draft exists. Mismatch returns 409.');

export const schemaDraftItemSchema = z.object({
  kind: schemaDraftKindSchema,
  item_id: z
    .string()
    .describe('Id of the live item this entry changes (client-generated for create)'),
  op: schemaDraftOpSchema,
  payload: z.unknown().nullable().describe('Staged create/update body; null for delete'),
  base_version: z
    .string()
    .nullable()
    .describe('Live version of the item when it was first staged; null for create'),
  updated_by: z.string().nullable(),
  updated_at: z.string().describe('ISO 8601 timestamp')
});

export const schemaDraftSchema = z.object({
  revision: z.number().int().describe('Current draft revision; 0 when no draft exists'),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  items: z.array(schemaDraftItemSchema)
});

const itemParams = ws.extend({ kind: schemaDraftKindSchema, itemId: z.string().min(1) });

export const workspaceSchemaDraftContract = oc.tag('Schema Draft').router({
  schemaDraft: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schema-draft',
        inputStructure: 'detailed',
        summary: 'Get the workspace schema draft',
        description: 'Returns the single shared draft (revision 0 and no items when none exists).',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws }))
      .output(schemaDraftSchema),
    stage: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/schema-draft/items/{kind}/{itemId}',
        inputStructure: 'detailed',
        summary: 'Stage a schema change',
        description:
          'Adds or replaces a draft item. Never changes live definitions. Returns 409 when expectedRevision is stale.',
        tags: ['Schema Draft']
      })
      .input(
        z.object({
          params: itemParams,
          body: z.object({
            expectedRevision: expectedRevisionSchema,
            op: schemaDraftOpSchema,
            payload: z.unknown().optional()
          })
        })
      )
      .output(schemaDraftSchema),
    unstage: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/schema-draft/items/{kind}/{itemId}',
        inputStructure: 'detailed',
        summary: 'Unstage a schema change',
        description: 'Removes an item from the draft. Returns 409 when expectedRevision is stale.',
        tags: ['Schema Draft']
      })
      .input(
        z.object({
          params: itemParams,
          query: z.object({ expectedRevision: z.coerce.number().int().min(0) })
        })
      )
      .output(schemaDraftSchema),
    discard: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/schema-draft',
        inputStructure: 'detailed',
        summary: 'Discard the schema draft',
        description: 'Deletes the draft and all items. Returns 409 when expectedRevision is stale.',
        tags: ['Schema Draft']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ expectedRevision: z.coerce.number().int().min(0) })
        })
      )
      .output(z.object({ success: z.boolean() })),
    getMode: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schema-draft/mode',
        inputStructure: 'detailed',
        summary: 'Get the schema change mode',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws }))
      .output(z.object({ schemaChangeMode: schemaChangeModeSchema })),
    setMode: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/schema-draft/mode',
        inputStructure: 'detailed',
        summary: 'Set the schema change mode',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws, body: z.object({ schemaChangeMode: schemaChangeModeSchema }) }))
      .output(z.object({ schemaChangeMode: schemaChangeModeSchema }))
  }
});

export type SchemaDraft = z.infer<typeof schemaDraftSchema>;
