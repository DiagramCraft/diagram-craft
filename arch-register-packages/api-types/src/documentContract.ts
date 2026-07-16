import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId } from '@arch-register/api-types/common';

const booleanQuerySchema = z.preprocess(value => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}, z.boolean().optional());

export const documentFieldTypeSchema = z.enum([
  'text',
  'long_text',
  'boolean',
  'date',
  'number',
  'enum',
  'entity_link',
  'document_link'
]);

export const documentRequirementSchema = z.enum(['required', 'expected', 'optional']);

const documentValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]);

export const documentMetadataSchema = z.record(z.string(), documentValueSchema);

export const documentEnumOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1)
});

export const documentFieldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: documentFieldTypeSchema,
  requirement: documentRequirementSchema,
  minCardinality: z.number().int().nonnegative().optional(),
  maxCardinality: z.number().int().nonnegative().optional(),
  enumOptions: z.array(documentEnumOptionSchema).optional(),
  retired: z.boolean().default(false)
});

export const documentTypeSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  description: z.string(),
  fields: z.array(documentFieldSchema),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

export const documentTemplateSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  project_id: z.string().nullable(),
  name: z.string(),
  body: z.string(),
  document_type_id: z.string(),
  metadata_defaults: documentMetadataSchema,
  archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

const documentTypeWriteSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  fields: z.array(documentFieldSchema),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional()
});

const documentTemplateWriteSchema = z.object({
  name: z.string().min(1),
  body: z.string(),
  document_type_id: z.string().min(1),
  metadata_defaults: documentMetadataSchema.default({}),
  project_id: z.string().nullable().optional()
});

export const documentContract = oc.tag('Typed Documents').router({
  documentTypes: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/document-types',
        inputStructure: 'detailed',
        summary: 'List document types',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: ws, query: z.object({ include_archived: booleanQuerySchema }) }))
      .output(z.array(documentTypeSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/document-types/{id}',
        inputStructure: 'detailed',
        summary: 'Get a document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId }))
      .output(documentTypeSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/document-types',
        inputStructure: 'detailed',
        summary: 'Create a document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: ws, body: documentTypeWriteSchema }))
      .output(documentTypeSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/document-types/{id}',
        inputStructure: 'detailed',
        summary: 'Update a document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId, body: documentTypeWriteSchema }))
      .output(documentTypeSchema),
    archive: oc
      .route({
        method: 'POST',
        path: '/{workspace}/document-types/{id}/archive',
        inputStructure: 'detailed',
        summary: 'Archive a document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId, body: z.object({ archived: z.boolean() }) }))
      .output(documentTypeSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/document-types/{id}',
        inputStructure: 'detailed',
        summary: 'Delete an unused document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.object({ deleted: z.boolean() }))
  },
  documentTemplates: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/document-templates',
        inputStructure: 'detailed',
        summary: 'List document templates',
        tags: ['Typed Documents']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({
            project_id: z.string().nullable().optional(),
            include_archived: booleanQuerySchema
          })
        })
      )
      .output(z.array(documentTemplateSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/document-templates',
        inputStructure: 'detailed',
        summary: 'Create a document template',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: ws, body: documentTemplateWriteSchema }))
      .output(documentTemplateSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/document-templates/{id}',
        inputStructure: 'detailed',
        summary: 'Update a document template',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId, body: documentTemplateWriteSchema }))
      .output(documentTemplateSchema),
    archive: oc
      .route({
        method: 'POST',
        path: '/{workspace}/document-templates/{id}/archive',
        inputStructure: 'detailed',
        summary: 'Archive a document template',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId, body: z.object({ archived: z.boolean() }) }))
      .output(documentTemplateSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/document-templates/{id}',
        inputStructure: 'detailed',
        summary: 'Delete a document template',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.object({ deleted: z.boolean() }))
  }
});

export type DocumentFieldType = z.infer<typeof documentFieldTypeSchema>;
export type DocumentRequirement = z.infer<typeof documentRequirementSchema>;
export type DocumentField = z.infer<typeof documentFieldSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;
export type DocumentTypeWrite = z.infer<typeof documentTypeWriteSchema>;
export type DocumentTemplateWrite = z.infer<typeof documentTemplateWriteSchema>;
