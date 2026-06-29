import { oc, eventIterator } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

// ── Contract ──────────────────────────────────────────────────

export const diagramCraftContract = oc
  .tag('Diagram Craft')
  .router({
    diagramCraft: {
      getSchemas: oc
        .route({
          method: 'GET',
          path: '/public/{workspace}/schemas',
          inputStructure: 'detailed',
          summary: 'Get public schemas',
          description: 'Retrieves publicly accessible schema definitions for diagram collaboration. Used by Diagram Craft for entity integration.',
          tags: ['Diagram Craft']
        })
        .input(z.object({ params: ws }))
        .output(z.array(z.unknown())),

      getData: oc
        .route({
          method: 'GET',
          path: '/public/{workspace}/data',
          inputStructure: 'detailed',
          summary: 'Get public entity data',
          description: 'Retrieves publicly accessible entity data for diagram collaboration. Used by Diagram Craft for entity references.',
          tags: ['Diagram Craft']
        })
        .input(z.object({ params: ws }))
        .output(z.array(z.unknown())),

      generate: oc
        .route({
          method: 'POST',
          path: '/{workspace}/ai/generate',
          inputStructure: 'detailed',
          summary: 'Generate diagram with AI',
          description: 'Uses AI to generate diagram content based on provided messages. Supports streaming responses for real-time generation.',
          tags: ['Diagram Craft']
        })
        .input(
          z.object({
            params: ws,
            body: z
              .object({
                messages: z.array(
                  z.object({
                    role: z.enum(['system', 'user', 'assistant']).describe('Message role'),
                    content: z.unknown().describe('Message content')
                  })
                ).describe('Conversation messages for AI generation'),
                stream: z.boolean().optional().describe('Whether to stream the response'),
                temperature: z.number().optional().describe('Temperature parameter for generation (0-2)'),
                max_tokens: z.number().optional().describe('Maximum tokens to generate')
              })
              .passthrough()
          })
        )
        .output(eventIterator(z.unknown()))
    }
  });