import { oc, eventIterator } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

// ── Contract ──────────────────────────────────────────────────

export const diagramCraftContract = {
  diagramCraft: {
    getSchemas: oc
      .route({ method: 'GET', path: '/public/{workspace}/schemas', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(z.array(z.unknown())),

    getData: oc
      .route({ method: 'GET', path: '/public/{workspace}/data', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(z.array(z.unknown())),

    generate: oc
      .route({
        method: 'POST',
        path: '/{workspace}/ai/generate',
        inputStructure: 'detailed'
      })
      .input(
        z.object({
          params: ws,
          body: z
            .object({
              messages: z.array(
                z.object({
                  role: z.enum(['system', 'user', 'assistant']),
                  content: z.unknown()
                })
              ),
              stream: z.boolean().optional(),
              temperature: z.number().optional(),
              max_tokens: z.number().optional()
            })
            .passthrough()
        })
      )
      .output(eventIterator(z.unknown()))
  }
};
