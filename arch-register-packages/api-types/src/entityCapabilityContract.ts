import { z } from 'zod';

/** A generic integration-backed capability that can be enabled by an entity schema. */
export const entityCapabilityTypeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, 'Entity capability type must be a lowercase hyphenated identifier')
  .max(100)
  .describe('Entity capability identifier, such as api-specification');

/** Schema-owned opt-in; capability metadata is resolved from the integration catalog. */
export const entityCapabilitySchema = z
  .object({
    type: entityCapabilityTypeSchema.describe('Entity capability enabled for this schema')
  })
  .describe('An entity capability enabled for entities using the schema');

export type EntityCapability = z.infer<typeof entityCapabilitySchema>;
export type EntityCapabilityType = z.infer<typeof entityCapabilityTypeSchema>;
