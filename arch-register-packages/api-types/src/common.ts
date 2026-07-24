import { z } from 'zod';

// ── Common Types ──────────────────────────────────────────────

export const ws = z.object({
  workspace: z.string()
});

export const wsAndId = z.object({
  workspace: z.string(),
  id: z.string()
});

export const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const wsAndUUID = z.object({
  workspace: z.string(),
  id: z.string().regex(UUID_REGEX)
});

export const foreignKeySchema = z.object({
  id: z.string(),
  name: z.string()
});

export const teamRoleSchema = z.enum(['team_admin', 'team_editor', 'team_reviewer']);

export const workspaceCapabilitySchema = z.enum([
  'ws.view',
  'ws.settings',
  'ws.delete',
  'ws.audit',
  'ws.manage_views',
  'people.invite',
  'people.role',
  'people.remove',
  'people.teams',
  'proj.create',
  'proj.edit',
  'proj.delete',
  'content.view',
  'content.edit',
  'ent.edit',
  'ent.propose',
  'ent.approve',
  'ent.override',
  'ent.external_update',
  'comments',
  'export',
  'schema.edit',
  'schema.publish'
]);

// ── External / AI-generated field metadata (shared by entity schemas & document types) ──────

// Presence of `external_kind` on a field definition is what makes a field "external" — there is
// no separate boolean flag. `refresh_mode` describes how the value is expected to be kept fresh
// and is independent of the producer.
export const externalKindSchema = z.enum(['ai', 'integration', 'automation']);

export const refreshModeSchema = z.enum(['on_change', 'scheduled']);

export const externalFieldSchema = z.object({
  external_kind: externalKindSchema.optional().describe('Producer that manages this field'),
  refresh_mode: refreshModeSchema
    .optional()
    .describe('How the external value is expected to be refreshed')
});

// `refresh_mode` is only meaningful once `external_kind` is set; apply with `.superRefine` (or
// equivalent) wherever a concrete field schema is assembled, since `externalFieldSchema` itself
// is merged/extended into other object schemas and must stay a plain ZodObject to support that.
export const assertRefreshModeRequiresExternalKind = (
  field: ExternalField,
  path: (string | number)[] = ['refresh_mode']
) =>
  field.refresh_mode === undefined || field.external_kind !== undefined
    ? undefined
    : { message: 'refresh_mode is only meaningful when external_kind is set', path };

export const externalMetadataResultSchema = z.object({
  fieldId: z.string().min(1),
  external_kind: externalKindSchema,
  status: z.enum(['success', 'failed', 'outdated']),
  source: z.string().min(1).describe('Free-form source label supplied by the updater'),
  timestamp: z.string().describe('ISO 8601 timestamp, inferred by the server'),
  explanation: z.string().nullable().optional(),
  findings: z.array(z.string()).optional(),
  sourceVersion: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .describe('Updater version, if applicable'),
  requestId: z
    .string()
    .nullable()
    .optional()
    .describe(
      'External request/run identifier, for tracing to an API call, job run, or AI generation'
    ),
  failureNotice: z.string().nullable().optional(),
  // AI-specific extras, retained for compatibility with existing document AI metadata.
  actionId: z.string().min(1).optional(),
  sourceRevision: z.number().int().positive().optional(),
  generatorVersion: z.number().int().positive().optional()
});

// Keyed by field id; represents the latest external result only (no history).
export const externalMetadataSchema = z.record(z.string().min(1), externalMetadataResultSchema);

export const externalUpdateEnvelopeSchema = z.object({
  // The single field this update targets; must carry a matching `external_kind`.
  fieldId: z.string().min(1),
  kind: externalKindSchema,
  source: z.string().min(1),
  // 'failed' reports an unsuccessful external update: the field's value must be left unchanged,
  // and `failureNotice` should explain why.
  status: z.enum(['success', 'failed']).default('success'),
  failureNotice: z.string().optional(),
  requestId: z.string().optional(),
  explanation: z.string().optional(),
  findings: z.array(z.string()).optional(),
  sourceVersion: z.union([z.string(), z.number()]).optional()
});

export type ExternalKind = z.infer<typeof externalKindSchema>;
export type RefreshMode = z.infer<typeof refreshModeSchema>;
export type ExternalField = z.infer<typeof externalFieldSchema>;
export type ExternalMetadataResult = z.infer<typeof externalMetadataResultSchema>;
export type ExternalMetadata = z.infer<typeof externalMetadataSchema>;
export type ExternalUpdateEnvelope = z.infer<typeof externalUpdateEnvelopeSchema>;
