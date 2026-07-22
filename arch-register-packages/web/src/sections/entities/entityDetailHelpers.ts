import type { EntityRelations, EntitySummary } from '@arch-register/api-types/entityContract';
import type { RefLookup } from './types/entityDetailTypes';

export const buildEntityRefLookup = (relations: EntityRelations): RefLookup => {
  const lookup: RefLookup = new Map<string, EntitySummary>();
  for (const relation of relations.outgoing) {
    lookup.set(relation.entityId, {
      _uid: relation.entityId,
      _publicId: relation.publicId,
      _schema: { id: relation.entitySchemaId, name: '' },
      _name: relation.entityName,
      _slug: relation.entitySlug,
      _namespace: '',
      _description: '',
      _owner: null,
      _lifecycle: null,
      _targetLifecycle: null,
      _targetLifecycleDate: null,
      _tags: [],
      _links: [],
      _projectId: null,
      _completeness: null,
      canView: true,
      canEdit: false,
      canDelete: false,
      canAdmin: false,
      canCreateChild: false
    });
  }
  return lookup;
};
