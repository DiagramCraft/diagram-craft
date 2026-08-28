import { oc } from '@orpc/contract';
import { z } from 'zod';
import { userSummarySchema } from '@arch-register/api-types/authContract';

const traceSqlSpanSchema = z.object({
  id: z.string(),
  durationMs: z.number(),
  sql: z.string(),
  params: z.array(z.string()).describe('Bound parameter values, stringified'),
  rowCount: z.number().nullable(),
  error: z.string().optional()
});

const traceRequestSpanSchema = z.object({
  spanId: z.string(),
  method: z.string(),
  path: z.string(),
  interaction: z.string().optional(),
  durationMs: z.number().nullable(),
  status: z.number().nullable(),
  error: z.string().optional(),
  sql: z.array(traceSqlSpanSchema)
});

const traceRecordSchema = z.object({
  traceId: z.string(),
  interaction: z.string().optional(),
  requests: z.array(traceRequestSpanSchema)
});

export const devContract = oc.tag('Dev').router({
  dev: {
    config: oc
      .route({
        method: 'GET',
        path: '/dev/config',
        summary: 'Get dev-mode tooling configuration',
        description:
          'Reports whether development-only tooling (such as the user switcher) is enabled. Always callable; reports disabled when the dev router is not mounted.',
        tags: ['Dev']
      })
      .output(
        z.object({
          enabled: z.boolean().describe('Whether dev-mode tooling is enabled'),
          tracingEnabled: z
            .boolean()
            .describe('Whether dev-mode request/SQL tracing is enabled')
        })
      ),
    trace: oc
      .route({
        method: 'GET',
        path: '/dev/trace/{traceId}',
        inputStructure: 'detailed',
        summary: 'Get a captured dev-mode trace (dev mode only)',
        description:
          'Returns the request and SQL spans captured for a trace id. Only available when dev-mode tracing is enabled.',
        tags: ['Dev']
      })
      .input(z.object({ params: z.object({ traceId: z.string() }) }))
      .output(traceRecordSchema.nullable()),
    listUsers: oc
      .route({
        method: 'GET',
        path: '/dev/users',
        summary: 'List all users (dev mode only)',
        description:
          'Retrieves every user in the database for the dev-mode user switcher. Only available when dev-mode tooling is enabled.',
        tags: ['Dev']
      })
      .output(z.array(userSummarySchema)),
    switchUser: oc
      .route({
        method: 'POST',
        path: '/dev/switch-user',
        inputStructure: 'detailed',
        summary: 'Switch active session to another user (dev mode only)',
        description:
          'Issues auth cookies for the given user without validating credentials, bypassing login. Only available when dev-mode tooling is enabled.',
        tags: ['Dev']
      })
      .input(
        z.object({ body: z.object({ userId: z.string().describe('Target user identifier') }) })
      )
      .output(z.object({ ok: z.boolean().describe('Whether the switch succeeded') }))
  }
});
