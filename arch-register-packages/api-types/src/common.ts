import { z } from 'zod';

// ── Common Types ──────────────────────────────────────────────

export const ws = z.object({
  workspace: z.string()
});

export const wsAndId = z.object({
  workspace: z.string(),
  id: z.string()
});

export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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
  'comments',
  'export',
  'schema.edit',
  'schema.publish'
]);
