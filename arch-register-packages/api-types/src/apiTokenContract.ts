import { z } from 'zod';
import { workspaceCapabilitySchema } from '@arch-register/api-types/common';

const timestampOutputSchema = z
  .union([z.string(), z.date()])
  .transform(value => (typeof value === 'string' ? value : value.toISOString()));

export const apiTokenSchema = z.object({
  id: z.string().describe('Unique API token identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Human-readable token name'),
  capabilities: z
    .array(workspaceCapabilitySchema)
    .describe('Workspace capabilities granted to the token'),
  created_by: z.string().nullable().describe('User who created the token, or null if removed'),
  created_by_name: z
    .string()
    .nullable()
    .describe('Display name of the creator at time of creation, or null if unknown'),
  created_at: timestampOutputSchema.describe('ISO 8601 creation timestamp'),
  last_used_at: timestampOutputSchema.nullable().describe('ISO 8601 last-use timestamp'),
  expires_at: timestampOutputSchema.nullable().describe('ISO 8601 expiration timestamp')
});

export const apiTokenCreateSchema = z.object({
  name: z.string().describe('Human-readable token name'),
  capabilities: z.array(workspaceCapabilitySchema).describe('Workspace capabilities to grant'),
  expires_at: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('Optional ISO 8601 expiration timestamp')
});

export const apiTokenCreatedSchema = apiTokenSchema.extend({
  token: z.string().describe('Raw API token. It is returned only once at creation time.')
});

export type WorkspaceApiToken = z.infer<typeof apiTokenSchema>;
export type WorkspaceApiTokenCreate = z.infer<typeof apiTokenCreateSchema>;
export type WorkspaceApiTokenCreated = z.infer<typeof apiTokenCreatedSchema>;
