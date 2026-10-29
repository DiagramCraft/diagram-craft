type AiChatToolJsonSchema = {
  type?: string | string[];
  properties?: Record<string, AiChatToolJsonSchema>;
  items?: AiChatToolJsonSchema;
  required?: string[];
  additionalProperties?: boolean | AiChatToolJsonSchema;
};

export const createEntityChatToolInputSchema: AiChatToolJsonSchema = {
  type: 'object',
  properties: {
    schemaId: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    namespace: { type: 'string' },
    description: { type: 'string' },
    owner: { type: ['string', 'null'] },
    lifecycle: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    fields: { type: 'object', additionalProperties: true }
  },
  required: ['schemaId'],
  additionalProperties: false
};

export const updateEntityChatToolInputSchema: AiChatToolJsonSchema = {
  type: 'object',
  properties: {
    entityId: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    namespace: { type: 'string' },
    description: { type: 'string' },
    owner: { type: ['string', 'null'] },
    lifecycle: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    fields: { type: 'object', additionalProperties: true }
  },
  required: ['entityId'],
  additionalProperties: false
};

export const createRelationChatToolInputSchema: AiChatToolJsonSchema = {
  type: 'object',
  properties: {
    schemaId: { type: 'string' },
    inEntityId: { type: 'string' },
    outEntityId: { type: 'string' },
    fields: { type: 'object', additionalProperties: true }
  },
  required: ['schemaId', 'inEntityId', 'outEntityId'],
  additionalProperties: false
};

export const updateRelationChatToolInputSchema: AiChatToolJsonSchema = {
  type: 'object',
  properties: {
    relationId: { type: 'string' },
    fields: { type: 'object', additionalProperties: true }
  },
  required: ['relationId', 'fields'],
  additionalProperties: false
};

export const deleteRelationChatToolInputSchema: AiChatToolJsonSchema = {
  type: 'object',
  properties: { relationId: { type: 'string' } },
  required: ['relationId'],
  additionalProperties: false
};
