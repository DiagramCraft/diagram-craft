import { isRelationLikeField, type EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import type { EntityEditState } from '../../../lib/entityEditState';

// A change case member is identified by a key: a plain entity id, `draft:<id>` for an entity that is
// created together with the case, or `relation:<id>` for a relation.
export const draftKey = (draftId: string) => `draft:${draftId}`;
export const isDraftKey = (key: string) => key.startsWith('draft:');
export const draftIdFromKey = (key: string) => key.slice('draft:'.length);

export const relationKey = (relationId: string) => `relation:${relationId}`;
export const isRelationKey = (key: string) => key.startsWith('relation:');
export const relationIdFromKey = (key: string) => key.slice('relation:'.length);

export type DraftEntity = {
  draftId: string;
  state: Record<string, unknown>;
  entity: EntityRecord;
};

const normalize = (value: unknown): string => {
  if (value == null) return '';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
};

/** Labels of the fields whose planned value differs from the entity's current value. */
export const computeChangedLabels = (
  entity: { _name?: string; _description?: string; _owner?: { id: string } | null } & Record<
    string,
    unknown
  >,
  schema: EntitySchema,
  planState: EntityEditState
): string[] => {
  const labels: string[] = [];
  const check = (label: string, current: unknown, next: unknown) => {
    if (normalize(current) !== normalize(next)) labels.push(label);
  };
  check('Name', entity['_name'] ?? '', planState['_name'] ?? '');
  check('Description', entity['_description'] ?? '', planState['_description'] ?? '');
  check('Owner', (entity['_owner'] as { id: string } | null)?.id ?? '', planState['_owner'] ?? '');
  check(
    'Lifecycle',
    (entity['_lifecycle'] as { id: string } | null)?.id ?? '',
    planState['_lifecycle'] ?? ''
  );
  check(
    'Target Lifecycle',
    (entity['_targetLifecycle'] as { id: string } | null)?.id ?? '',
    planState['_targetLifecycle'] ?? ''
  );
  check(
    'Target Lifecycle Date',
    entity['_targetLifecycleDate'] ?? '',
    planState['_targetLifecycleDate'] ?? ''
  );
  for (const field of schema.fields) {
    if (isRelationLikeField(field)) continue;
    check(field.name, entity[field.id], planState[field.id]);
  }
  return labels;
};

/** Builds the record shown for an entity that only exists as a draft within the change case. */
export const buildDraftEntityRecord = (
  id: string,
  state: Record<string, unknown>,
  schemas: EntitySchema[],
  projectId: string
): EntityRecord => {
  const schemaId = String(state['schema_id']);
  const schema = schemas.find(item => item.id === schemaId);
  const ref = (value: unknown) => (value ? { id: String(value), name: String(value) } : null);
  return {
    _uid: id,
    _publicId: id,
    _schema: { id: schemaId, name: schema?.name ?? schemaId },
    _name: String(state['name'] ?? ''),
    _slug: String(state['slug'] ?? ''),
    _namespace: String(state['namespace'] ?? 'default'),
    _description: String(state['description'] ?? ''),
    _owner: ref(state['owner']),
    _lifecycle: ref(state['lifecycle']),
    _targetLifecycle: ref(state['target_lifecycle']),
    _targetLifecycleDate: (state['target_lifecycle_date'] as string | null) ?? null,
    _tags: Array.isArray(state['tags'])
      ? state['tags'].filter((v): v is string => typeof v === 'string')
      : [],
    _links: Array.isArray(state['links']) ? state['links'] : [],
    _updatedAt: new Date().toISOString(),
    _version: 1,
    _projectId: projectId,
    _completeness: null,
    ...(state['data'] as Record<string, unknown>)
  } as unknown as EntityRecord;
};

/**
 * Entities (project entities and drafts) that reference fields in a draft entity form can point to,
 * grouped by schema.
 */
export const buildReferenceOptions = (
  projectEntities: ProjectEntity[],
  draftEntities: DraftEntity[],
  projectId: string
): Record<string, EntitySummary[]> => {
  const candidates = [
    ...projectEntities.map(entity => ({
      id: entity.entity_id,
      name: entity.entity_name,
      slug: entity.entity_slug,
      schemaId: entity.entity_schema?.id ?? null,
      schemaName: entity.entity_schema?.name ?? null
    })),
    ...draftEntities.map(draft => ({
      id: draft.draftId,
      name: draft.entity._name,
      slug: draft.entity._slug,
      schemaId: draft.entity._schema.id,
      schemaName: draft.entity._schema.name
    }))
  ];

  const bySchema: Record<string, EntitySummary[]> = {};
  for (const candidate of candidates) {
    if (!candidate.schemaId) continue;
    const summary = {
      _uid: candidate.id,
      _publicId: candidate.id,
      _schema: { id: candidate.schemaId, name: candidate.schemaName ?? candidate.schemaId },
      _name: candidate.name,
      _slug: candidate.slug,
      _namespace: 'default',
      _description: '',
      _owner: null,
      _lifecycle: null,
      _targetLifecycle: null,
      _targetLifecycleDate: null,
      _tags: [],
      _links: [],
      _projectId: projectId,
      _completeness: null
    } as unknown as EntitySummary;
    (bySchema[candidate.schemaId] ??= []).push(summary);
  }
  return bySchema;
};
