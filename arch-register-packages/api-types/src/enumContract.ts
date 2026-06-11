import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId } from '@arch-register/api-types/common';

const enumOptionSchema = z.object({
  value: z.string(),
  label: z.string()
});

const workspaceEnumSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  options: z.array(enumOptionSchema),
  sort_order: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string()
});

const createEnumBodySchema = z.object({
  name: z.string(),
  options: z.preprocess(
    value => (Array.isArray(value) ? value : undefined),
    z.array(enumOptionSchema).optional()
  ),
  sort_order: z.preprocess(
    value => (typeof value === 'number' ? value : undefined),
    z.number().int().min(0).optional()
  )
});

export const workspaceEnumContract = {
  enums: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/enums', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(z.array(workspaceEnumSchema)),
    get: oc
      .route({ method: 'GET', path: '/{workspace}/enums/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(workspaceEnumSchema),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/enums', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          body: createEnumBodySchema
        })
      )
      .output(workspaceEnumSchema),
    update: oc
      .route({ method: 'PUT', path: '/{workspace}/enums/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndId,
          body: createEnumBodySchema
        })
      )
      .output(workspaceEnumSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/enums/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: wsAndId
        })
      )
      .output(
        z.object({
          success: z.boolean(),
          message: z.string()
        })
      )
  }
};

export type WorkspaceEnum = z.infer<typeof workspaceEnumSchema>;

export type CreateEnumRequest = z.infer<typeof createEnumBodySchema>;

export type UpdateEnumRequest = CreateEnumRequest;
