import { entityCapabilityTypeSchema, type EntityCapabilityType } from './entityCapabilityContract';
import { z } from 'zod';

/** Integration-owned metadata for a capability available to entity schemas. */
export const entityCapabilityDefinitionSchema = z.object({
  type: entityCapabilityTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  features: z.array(z.string().min(1)),
  requiredFields: z.array(z.string().min(1))
});

export type EntityCapabilityDefinition = z.infer<typeof entityCapabilityDefinitionSchema>;

export const entityCapabilityDefinitions: EntityCapabilityDefinition[] = [
  {
    type: 'api-specification',
    label: 'API specification',
    description: 'OpenAPI and AsyncAPI documents with normalized operations or messages.',
    features: ['operations', 'documentation'],
    requiredFields: ['api_type', 'api_version']
  }
];

export const getEntityCapabilityDefinition = (type: EntityCapabilityType | string) =>
  entityCapabilityDefinitions.find(capability => capability.type === type);
