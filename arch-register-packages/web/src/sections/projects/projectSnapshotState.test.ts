import { describe, expect, it } from 'vitest';
import { findSnapshotConflicts, resolveSnapshotEntityData } from './projectSnapshotState';

const schema = { fields: [{ id: 'criticality', name: 'Criticality' }] } as never;
const entity = {
  _schema: { id: 'service' },
  _name: 'Live name',
  _slug: 'service',
  _namespace: '',
  _description: 'Live description',
  _owner: { id: 'team-live' },
  _lifecycle: null,
  _targetLifecycle: null,
  _targetLifecycleDate: null,
  _tags: ['live'],
  _links: [],
  _projectId: null,
  criticality: 'high'
} as never;
const base = {
  name: 'Base name',
  description: 'Base description',
  owner: 'team-base',
  tags: ['base'],
  data: { criticality: 'low' }
};
const proposed = {
  name: 'Planned name',
  description: 'Base description',
  owner: 'team-base',
  tags: ['planned'],
  data: { criticality: 'medium' }
};

describe('project snapshot state', () => {
  it('reports only fields changed in both the plan and live entity', () => {
    expect(
      findSnapshotConflicts(entity, schema, proposed, base).map(conflict => conflict.key)
    ).toEqual(['name', 'tags', 'data.criticality']);
  });

  it('resolves conflicts using the explicit current choice', () => {
    const resolved = resolveSnapshotEntityData({
      entity,
      schema,
      proposed,
      base,
      conflictChoices: { name: 'current', tags: 'current', 'data.criticality': 'current' }
    });
    expect(resolved).toMatchObject({ _name: 'Live name', _tags: ['live'], criticality: 'high' });
  });

  it('keeps the live value when a field was not changed by the plan', () => {
    const resolved = resolveSnapshotEntityData({
      entity,
      schema,
      proposed,
      base,
      conflictChoices: {}
    });
    expect(resolved._description).toBe('Live description');
  });

  it('does not treat differently-shaped empty values as a conflict or a planned change', () => {
    const emptyEntity = {
      _schema: { id: 'service' },
      _name: 'Live name',
      _slug: 'service',
      _namespace: '',
      _description: 'Live description',
      _owner: { id: 'team-live' },
      _lifecycle: null,
      _targetLifecycle: null,
      _targetLifecycleDate: null,
      _tags: ['live'],
      _links: [],
      _projectId: null,
      criticality: 'high'
    } as never;
    const emptyBase = { ...base, target_lifecycle: undefined, target_lifecycle_date: null };
    const emptyProposed = { ...proposed, target_lifecycle: '', target_lifecycle_date: '' };

    expect(
      findSnapshotConflicts(emptyEntity, schema, emptyProposed, emptyBase).map(c => c.key)
    ).not.toContain('target_lifecycle');

    const resolved = resolveSnapshotEntityData({
      entity: emptyEntity,
      schema,
      proposed: emptyProposed,
      base: emptyBase,
      conflictChoices: {}
    });
    expect(resolved._targetLifecycleDate).toBeNull();
  });
});
