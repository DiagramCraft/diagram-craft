import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { ExtractEntityInput } from '../../lib/extractOperations';

export type ExtractPhase = 'input' | 'scanning' | 'review' | 'done';
export type ExtractInputTab = 'paste' | 'upload';
export type ExtractedEntity = {
  id: string;
  name: string;
  schema_id: string;
  fields: Record<string, unknown>;
  confidence: number;
  source: string;
  accepted: boolean;
  expanded: boolean;
};
export type CommittedExtractEntity = { id: string; name: string; schema_id: string };

export const normalizeExtractedEntities = (values: unknown[]): ExtractedEntity[] =>
  values.map((value, index) => {
    const entity =
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    return {
      id: `extract-${index}`,
      name: typeof entity.name === 'string' ? entity.name : '',
      schema_id: typeof entity.schema_id === 'string' ? entity.schema_id : '',
      fields:
        typeof entity.fields === 'object' && entity.fields !== null
          ? (entity.fields as Record<string, unknown>)
          : {},
      confidence: typeof entity.confidence === 'number' ? entity.confidence : 0,
      source: typeof entity.source === 'string' ? entity.source : '',
      accepted: true,
      expanded: false
    };
  });

export const updateExtractRow = (
  rows: ExtractedEntity[],
  id: string,
  update: (row: ExtractedEntity) => ExtractedEntity
) => rows.map(row => (row.id === id ? update(row) : row));

export const buildExtractCommitInput = (rows: ExtractedEntity[]): ExtractEntityInput[] =>
  rows
    .filter(row => row.accepted)
    .map(row => ({
      name: row.name,
      schemaId: row.schema_id,
      fields: row.fields
    }));

export const toCommittedExtractEntities = (entities: EntityRecord[]): CommittedExtractEntity[] =>
  entities.map(entity => ({ id: entity._uid, name: entity._name, schema_id: entity._schema.id }));
