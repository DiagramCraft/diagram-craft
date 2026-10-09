import { z } from 'zod';

export const workspaceApplicationSchema = z.object({
  id: z.string().describe('Unique application identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  key: z.string().describe('URL-safe slug, unique within the workspace'),
  name: z.string().describe('Application name'),
  description: z.string().describe('Application description; empty when not set'),
  accentColor: z.string().nullable().describe('Accent color; null when not set'),
  order: z.number().int().describe('Position among the workspace applications, ascending'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp'),
  updatedBy: z.string().nullable().describe('Identifier of the user who last updated the application')
});

export type WorkspaceApplication = z.infer<typeof workspaceApplicationSchema>;

export const createApplicationBodySchema = z.object({
  key: z.string().describe('URL-safe slug, unique within the workspace'),
  name: z.string().describe('Application name'),
  description: z.string().optional().describe('Application description'),
  accentColor: z.string().nullable().optional().describe('Accent color')
});

export type CreateApplicationRequest = z.infer<typeof createApplicationBodySchema>;

export const updateApplicationBodySchema = z.object({
  name: z.string().optional().describe('Application name'),
  description: z.string().optional().describe('Application description'),
  accentColor: z.string().nullable().optional().describe('Accent color')
});

export type UpdateApplicationRequest = z.infer<typeof updateApplicationBodySchema>;
