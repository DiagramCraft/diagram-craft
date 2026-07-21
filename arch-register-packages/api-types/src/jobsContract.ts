import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';

const jobRunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
const jobServerStatusSchema = z.enum(['available', 'unavailable']);

const jobServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: jobServerStatusSchema,
  last_seen_at: z.string()
});

const recurrenceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('minutes'),
    intervalMinutes: z.number().int().positive(),
    startsAt: z.string()
  }),
  z.object({
    type: z.literal('hours'),
    intervalHours: z.number().int().positive(),
    startsAt: z.string()
  }),
  z.object({
    type: z.literal('daily'),
    timeUtc: z.string()
  }),
  z.object({
    type: z.literal('weekly'),
    weekdayUtc: z.number().int().min(0).max(6),
    timeUtc: z.string()
  })
]);

const jobScheduleSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  job_type: z.string(),
  system_identity: z.string(),
  target_schema_id: z.string().nullable(),
  target_schema_name: z.string().nullable(),
  priority: z.number().int(),
  recurrence: recurrenceSchema,
  enabled: z.boolean(),
  next_occurrence_at: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

const technologyEolMappingSchema = z.object({
  productFieldId: z.string().min(1),
  cycleFieldId: z.string().min(1),
  latestVersionFieldId: z.string().min(1).nullable(),
  releaseDateFieldId: z.string().min(1).nullable(),
  supportUntilFieldId: z.string().min(1).nullable(),
  securityUntilFieldId: z.string().min(1).nullable(),
  eolDateFieldId: z.string().min(1).nullable(),
  sourceUrlFieldId: z.string().min(1).nullable(),
  synchronizedAtFieldId: z.string().min(1).nullable()
});

const jobFrequencySchema = z.object({
  unit: z.enum(['minutes', 'hours']),
  value: z.number().int().positive()
});

const createJobBodySchema = z.discriminatedUnion('jobType', [
  z.object({
    jobType: z.literal('technology-eol'),
    schemaId: z.string().min(1),
    mapping: technologyEolMappingSchema,
    frequency: jobFrequencySchema
  })
]);

const jobRunSchema = z.object({
  id: z.string(),
  schedule_id: z.string().nullable(),
  workspace: z.string(),
  job_type: z.string(),
  system_identity: z.string(),
  priority: z.number().int(),
  occurrence_at: z.string(),
  coalesced_through_at: z.string(),
  coalesced_count: z.number().int(),
  planned_at: z.string(),
  created_at: z.string(),
  status: jobRunStatusSchema,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  queue_delay_ms: z.number().int().nonnegative().nullable(),
  duration_ms: z.number().int().nonnegative().nullable(),
  worker_id: z.string().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  attempt_count: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive()
});

const jobRunListQuerySchema = z.object({
  scheduleId: z.string().optional(),
  status: jobRunStatusSchema.optional(),
  plannedFrom: z.string().optional(),
  plannedTo: z.string().optional(),
  limit: z.preprocess(
    value => (value !== undefined ? Number(value) : undefined),
    z.number().int().positive().max(100).default(50)
  ),
  offset: z.preprocess(
    value => (value !== undefined ? Number(value) : undefined),
    z.number().int().nonnegative().default(0)
  )
});

const jobRunPageSchema = z.object({
  items: z.array(jobRunSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative()
});

export const jobsContract = oc.tag('Jobs').router({
  jobs: {
    servers: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/jobs/servers',
          inputStructure: 'detailed',
          summary: 'List job servers',
          description:
            'Lists known job servers for workspace administrators. Available servers with no status ping in the last two minutes are reported as unavailable.',
          tags: ['Jobs']
        })
        .input(z.object({ params: ws }))
        .output(z.array(jobServerSchema))
    },
    schedules: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/jobs/schedules',
          inputStructure: 'detailed',
          summary: 'List workspace job schedules',
          description:
            'Lists recurring job schedules for workspace administrators, including configured target schemas.',
          tags: ['Jobs']
        })
        .input(z.object({ params: ws }))
        .output(z.array(jobScheduleSchema)),
      create: oc
        .route({
          method: 'POST',
          path: '/{workspace}/jobs/schedules',
          inputStructure: 'detailed',
          summary: 'Create a configured workspace job',
          description:
            'Creates an enabled recurring workspace job and applies its external field configuration atomically.',
          tags: ['Jobs']
        })
        .input(z.object({ params: ws, body: createJobBodySchema }))
        .output(jobScheduleSchema)
    },
    runs: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/jobs/runs',
          inputStructure: 'detailed',
          summary: 'List workspace job runs',
          description:
            'Lists retained scheduled-job history for workspace administrators. Planned execution is best-effort and actual start time may be later.',
          tags: ['Jobs']
        })
        .input(
          z.object({
            params: ws,
            query: jobRunListQuerySchema
          })
        )
        .output(jobRunPageSchema),
      cancel: oc
        .route({
          method: 'POST',
          path: '/{workspace}/jobs/runs/{id}/cancel',
          inputStructure: 'detailed',
          summary: 'Cancel a queued workspace job run',
          description:
            'Cancels a queued scheduled-job run without changing its recurring schedule. Running jobs are not interrupted.',
          tags: ['Jobs']
        })
        .input(z.object({ params: wsAndUUID }))
        .output(jobRunSchema)
    }
  }
});

export type JobRunStatus = z.infer<typeof jobRunStatusSchema>;
export type JobServerStatus = z.infer<typeof jobServerStatusSchema>;
export type JobServer = z.infer<typeof jobServerSchema>;
export type JobSchedule = z.infer<typeof jobScheduleSchema>;
export type JobRun = z.infer<typeof jobRunSchema>;
export type JobRunPage = z.infer<typeof jobRunPageSchema>;
export type TechnologyEolMapping = z.infer<typeof technologyEolMappingSchema>;
export type JobFrequency = z.infer<typeof jobFrequencySchema>;
export type CreateJobBody = z.infer<typeof createJobBodySchema>;
