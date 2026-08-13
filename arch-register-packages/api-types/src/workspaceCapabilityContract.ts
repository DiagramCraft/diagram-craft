import { z } from 'zod';

export const workspaceCapabilityTypeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, 'Workspace capability type must be a lowercase hyphenated identifier')
  .max(100)
  .describe('Workspace capability identifier, such as api-specification');

/** Workspace model object that can participate in a capability binding. */
export const workspaceCapabilityTargetKindSchema = z.enum([
  'entity_schema',
  'relation_schema',
  'document_type'
]);

export const workspaceCapabilityTargetSchema = z.object({
  kind: workspaceCapabilityTargetKindSchema.describe('Kind of workspace model object'),
  id: z.string().min(1).describe('Identifier of the referenced workspace model object')
});

/** A capability-specific semantic role bound to a workspace model object. */
export const workspaceCapabilityBindingSchema = z.object({
  target: workspaceCapabilityTargetSchema,
  fieldMappings: z
    .record(z.string().min(1), z.string().min(1))
    .optional()
    .describe('Integration semantic role IDs mapped to fields on the target')
});

export const workspaceCapabilityBindingsSchema = z
  .record(z.string().min(1), workspaceCapabilityBindingSchema)
  .describe('Capability-specific semantic roles bound to workspace model objects');

export const workspaceCapabilityDiagnosticSchema = z.object({
  code: z.enum([
    'unknown_capability',
    'missing_binding',
    'unknown_binding',
    'unknown_target',
    'wrong_target_kind',
    'invalid_field_mapping'
  ]),
  bindingId: z.string().optional(),
  message: z.string()
});

export const workspaceCapabilityConfigurationSchema = z.object({
  id: z.string().describe('Stable workspace capability configuration identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  type: workspaceCapabilityTypeSchema.describe('Integration-backed capability identifier'),
  bindings: workspaceCapabilityBindingsSchema,
  valid: z.boolean().describe('Whether all configured targets and field mappings are valid'),
  diagnostics: z
    .array(workspaceCapabilityDiagnosticSchema)
    .describe('Configuration diagnostics; empty when the configuration is valid'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

export const workspaceCapabilityConfigurationInputSchema = z.object({
  bindings: workspaceCapabilityBindingsSchema
});

export type WorkspaceCapabilityTargetKind = z.infer<typeof workspaceCapabilityTargetKindSchema>;
export type WorkspaceCapabilityType = z.infer<typeof workspaceCapabilityTypeSchema>;
export type WorkspaceCapabilityTarget = z.infer<typeof workspaceCapabilityTargetSchema>;
export type WorkspaceCapabilityBinding = z.infer<typeof workspaceCapabilityBindingSchema>;
export type WorkspaceCapabilityBindings = z.infer<typeof workspaceCapabilityBindingsSchema>;
export type WorkspaceCapabilityDiagnostic = z.infer<typeof workspaceCapabilityDiagnosticSchema>;
export type WorkspaceCapabilityConfiguration = z.infer<
  typeof workspaceCapabilityConfigurationSchema
>;
export type WorkspaceCapabilityConfigurationInput = z.infer<
  typeof workspaceCapabilityConfigurationInputSchema
>;
