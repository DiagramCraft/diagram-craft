import { orpcClient } from './orpcClient';

export type ExtractEntityInput = {
  name: string;
  schemaId: string;
  fields: Record<string, unknown>;
};

export const createExtractedEntities = (workspace: string, entities: ExtractEntityInput[]) =>
  orpcClient.entities.bulkCreate({
    params: { workspace },
    body: {
      entities: entities.map(entity => ({
        _schemaId: entity.schemaId,
        _name: entity.name,
        _description: '',
        ...entity.fields
      }))
    }
  });
