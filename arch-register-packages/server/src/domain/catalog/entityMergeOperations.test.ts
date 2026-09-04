import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { Entity, SchemaDbResult } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import { buildFieldConflicts, buildRelationConflicts } from './entityMergeOperations';
import {
  buildMergeSideTableAutoDedupeRowIds,
  buildMergeSideTableConflicts,
  type MergeSideTableRow
} from './db/entityMergeDatabase';

const now = new Date('2026-09-04T12:00:00.000Z');

const makeEntity = (overrides: Partial<Entity>): Entity =>
  ({
    id: 'entity',
    workspace: 'ws-1',
    public_id: 'REC-1',
    slug: 'rec',
    namespace: 'default',
    name: 'Record',
    description: '',
    owner: 'team-owner',
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: 'schema-1',
    data: {},
    project_id: null,
    created_at: now,
    updated_at: now,
    ...overrides
  }) as Entity;

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [
    { id: 'tier', name: 'Tier', type: 'text' } as never,
    { id: 'secret', name: 'Secret', type: 'text', groupId: 'restricted' } as never
  ],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-owner'] } }],
  templates: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
} as unknown as SchemaDbResult;

const authCtx = (withAccess: boolean) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: 'editor',
    teamAssignments: withAccess ? [{ teamId: 'team-owner', role: 'team_reviewer' }] : [],
    schemas: [],
    entities: [],
    grants: []
  });

describe('buildFieldConflicts', () => {
  it('reports core and visible data field differences', () => {
    const source = makeEntity({ name: 'New name', data: { tier: 'gold' } });
    const target = makeEntity({ name: 'Old name', data: { tier: 'silver' } });

    const conflicts = buildFieldConflicts(source, target, schema, schema, authCtx(true));

    expect(conflicts).toContainEqual({
      fieldKey: 'core:name',
      fieldName: 'name',
      kind: 'core',
      source: 'New name',
      target: 'Old name',
      restricted: false
    });
    expect(conflicts).toContainEqual({
      fieldKey: 'data:tier',
      fieldName: 'Tier',
      kind: 'data',
      source: 'gold',
      target: 'silver',
      restricted: false
    });
  });

  it('flags a restricted data field without leaking its values', () => {
    const source = makeEntity({ data: { secret: 'source-secret' } });
    const target = makeEntity({ data: { secret: 'target-secret' } });

    const conflicts = buildFieldConflicts(source, target, schema, schema, authCtx(false));

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      fieldName: 'Secret',
      kind: 'data',
      source: null,
      target: null,
      restricted: true
    });
    expect(conflicts[0]?.fieldKey).toMatch(/^data:[a-f0-9]{64}$/);
    expect(JSON.stringify(conflicts)).not.toContain('secret');
  });

  it('shows restricted field values to a caller with field-group access', () => {
    const source = makeEntity({ data: { secret: 'source-secret' } });
    const target = makeEntity({ data: { secret: 'target-secret' } });

    const conflicts = buildFieldConflicts(source, target, schema, schema, authCtx(true));

    expect(conflicts).toEqual([
      {
        fieldKey: 'data:secret',
        fieldName: 'Secret',
        kind: 'data',
        source: 'source-secret',
        target: 'target-secret',
        restricted: false
      }
    ]);
  });

  it('returns nothing when the entities are identical', () => {
    const entity = makeEntity({ data: { tier: 'gold' } });
    expect(buildFieldConflicts(entity, entity, schema, schema, authCtx(true))).toEqual([]);
  });
});

const makeRelation = (overrides: Partial<RelationDbResult>): RelationDbResult =>
  ({
    id: 'rel',
    workspace: 'ws-1',
    schema_id: 'rs-1',
    schema_name: 'depends on',
    in_entity_id: 'source',
    in_entity_name: 'Source',
    out_entity_id: 'other',
    out_entity_name: 'Other',
    data: {},
    owner: null,
    owner_name: null,
    lifecycle: null,
    lifecycle_label: null,
    version: 1,
    approval_policy_override: null,
    created_at: now,
    updated_at: now,
    ...overrides
  }) as RelationDbResult;

describe('buildRelationConflicts', () => {
  const relationSchemas = [{ id: 'rs-1', name: 'depends on' }];

  it('flags a relation that would collapse to a self-relation', () => {
    const rel = makeRelation({ id: 'r1', in_entity_id: 'source', out_entity_id: 'target' });
    const conflicts = buildRelationConflicts('source', 'target', [rel], relationSchemas);
    expect(conflicts).toEqual([
      {
        relationId: 'r1',
        relationSchemaId: 'rs-1',
        relationSchemaName: 'depends on',
        direction: 'in',
        otherRecordId: 'target',
        otherRecordName: 'Other',
        duplicateRelationId: null,
        note: 'self'
      }
    ]);
  });

  it('flags a relation that would duplicate an existing target relation', () => {
    const sourceRel = makeRelation({ id: 'r1', in_entity_id: 'source', out_entity_id: 'other' });
    const targetRel = makeRelation({ id: 'r2', in_entity_id: 'target', out_entity_id: 'other' });
    const conflicts = buildRelationConflicts(
      'source',
      'target',
      [sourceRel, targetRel],
      relationSchemas
    );
    expect(conflicts).toEqual([
      {
        relationId: 'r1',
        relationSchemaId: 'rs-1',
        relationSchemaName: 'depends on',
        direction: 'in',
        otherRecordId: 'other',
        otherRecordName: 'Other',
        duplicateRelationId: 'r2',
        note: 'duplicate'
      }
    ]);
  });

  it('does not flag a relation with no matching target relation', () => {
    const sourceRel = makeRelation({ id: 'r1', in_entity_id: 'source', out_entity_id: 'other' });
    expect(buildRelationConflicts('source', 'target', [sourceRel], relationSchemas)).toEqual([]);
  });
});

describe('buildMergeSideTableConflicts', () => {
  const rows = (sourceDedupeKey: string, targetDedupeKey: string): MergeSideTableRow[] => [
    {
      table: 'project_entity',
      rowId: '{"entity_id":"source"}',
      entityId: 'source',
      uniqueKey: '{"project_id":"project"}',
      dedupeKey: sourceDedupeKey
    },
    {
      table: 'project_entity',
      rowId: '{"entity_id":"target"}',
      entityId: 'target',
      uniqueKey: '{"project_id":"project"}',
      dedupeKey: targetDedupeKey
    }
  ];

  it('auto-deduplicates identical side-table rows', () => {
    const snapshot = rows('same', 'same');
    expect(buildMergeSideTableConflicts(snapshot, 'source', 'target')).toEqual([]);
    expect(buildMergeSideTableAutoDedupeRowIds(snapshot, 'source', 'target')).toEqual([
      '{"entity_id":"source"}'
    ]);
  });

  it('surfaces non-identical side-table collisions for explicit resolution', () => {
    const snapshot = rows('source-row', 'target-row');
    expect(buildMergeSideTableConflicts(snapshot, 'source', 'target')).toHaveLength(1);
    expect(buildMergeSideTableAutoDedupeRowIds(snapshot, 'source', 'target')).toEqual([]);
  });
});
