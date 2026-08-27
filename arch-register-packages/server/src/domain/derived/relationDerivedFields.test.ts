import { describe, expect, it } from 'vitest';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import {
  buildDerivedPlan,
  materializeDerivedFields,
  validateDerivedFieldGroupAccess
} from './derivedFields';
import { buildRelationProjection } from './relationProjection';
import { recalculateEntityDerivedFields } from './derivedRecalculation';

const relationContext = { objectType: 'relation' as const, objectId: 'relation-1' };

const textField = (id: string, groupId?: string): RelationField =>
  ({ id, name: id, type: 'text', ...(groupId ? { groupId } : {}) }) as RelationField;

const derivedField = (
  id: string,
  expression: string,
  groupId?: string,
  resultType: 'text' | 'number' = 'text'
): RelationField =>
  ({
    id,
    name: id,
    type: 'derived',
    requirementLevel: 'optional',
    expression,
    resultType,
    ...(groupId ? { groupId } : {})
  }) as RelationField;

const entityRelationField = (id: string, schemaId: string): RelationField =>
  ({
    id,
    name: id,
    type: 'entityRelation',
    schemaId,
    minCount: 0,
    maxCount: -1
  }) as RelationField;

describe('relation-rooted derived fields', () => {
  it('allows an expression to read the relation own fields', () => {
    const fields = [textField('source'), derivedField('label', "relation.source + ' flow'")];
    expect(materializeDerivedFields(fields, { source: 'eu' }, relationContext, [])).toEqual({
      source: 'eu',
      label: 'eu flow'
    });
  });

  it('defers endpoint-dependent derived fields until a projection is supplied', () => {
    const fields = [
      derivedField(
        'cross_boundary',
        "relation._in.residency == relation._out.residency ? 'no' : 'yes'"
      )
    ];
    // No projection: relation._in / relation._out are unavailable, value is dropped.
    expect(materializeDerivedFields(fields, {}, relationContext, [])).toEqual({});

    const projection = { _in: { residency: 'eu' }, _out: { residency: 'us' } };
    expect(materializeDerivedFields(fields, {}, relationContext, [], projection)).toEqual({
      cross_boundary: 'yes'
    });
  });

  it('reads carried entities through an entityRelation field', () => {
    const fields = [
      textField('dest_region'),
      entityRelationField('assets', 'data-entity'),
      derivedField(
        'permitted_count',
        'relation.assets.map(.permitted_regions) |> flatten |> count',
        undefined,
        'number'
      )
    ];
    const projection = {
      dest_region: 'us',
      assets: [{ permitted_regions: ['eu'] }, { permitted_regions: ['eu', 'apac'] }]
    };
    expect(
      materializeDerivedFields(fields, { dest_region: 'us' }, relationContext, [], projection)
    ).toEqual({ dest_region: 'us', permitted_count: 3 });
  });

  it('rejects an unknown relation field reference in the plan', () => {
    expect(() => buildDerivedPlan([derivedField('x', 'relation.nope')], 'relation')).toThrow(
      /unknown relation field 'nope'/
    );
  });

  it('enforces restricted-input / unrestricted-output on relation schemas', () => {
    expect(() =>
      validateDerivedFieldGroupAccess(
        [textField('secret', 'restricted'), derivedField('leak', 'relation.secret')],
        [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-a'] } }],
        'relation'
      )
    ).toThrow(/leak.*secret/);
  });
});

// -- projection + recalculation --------------------------------------------------

const entity = (id: string, schemaId: string, data: Record<string, unknown>) =>
  ({
    id,
    workspace: 'workspace-1',
    public_id: id,
    slug: id,
    namespace: '',
    name: id,
    description: '',
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: schemaId,
    data,
    project_id: null,
    completeness: 0,
    created_at: new Date(0),
    updated_at: new Date(0),
    owner_name: null,
    lifecycle_label: null,
    target_lifecycle_label: null,
    schema_name: schemaId
  }) as EntityDbResult;

const entitySchema = (id: string, fields: SchemaDbResult['fields']) =>
  ({
    id,
    workspace: 'workspace-1',
    name: id,
    description: '',
    fields,
    groups: [],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: id.slice(0, 3).toUpperCase(),
    created_at: new Date(0),
    updated_at: new Date(0)
  }) as SchemaDbResult;

const relationRow = (data: Record<string, unknown>) =>
  ({
    id: 'relation-1',
    workspace: 'workspace-1',
    schema_id: 'data-flow',
    in_entity_id: 'system-a',
    out_entity_id: 'system-b',
    in_entity_name: 'system-a',
    out_entity_name: 'system-b',
    schema_name: 'data-flow',
    data,
    owner: null,
    lifecycle: null,
    version: 1,
    approval_policy_override: null,
    created_at: new Date(0),
    updated_at: new Date(0)
  }) as unknown as RelationDbResult;

const relationSchema = (fields: RelationField[]) =>
  ({
    id: 'data-flow',
    workspace: 'workspace-1',
    name: 'Data flow',
    description: '',
    in_schema_ids: 'any',
    out_schema_ids: 'any',
    fields,
    groups: [],
    color: null,
    icon: null,
    created_at: new Date(0),
    updated_at: new Date(0)
  }) as RelationSchemaDbResult;

describe('buildRelationProjection', () => {
  it('exposes own fields plus in/out endpoints and entityRelation targets', () => {
    const entities = [
      entity('system-a', 'system', { residency: 'eu' }),
      entity('system-b', 'system', { residency: 'us' }),
      entity('asset-1', 'data-entity', { permitted_regions: ['eu'] })
    ];
    const schemas = [
      entitySchema('system', [{ id: 'residency', name: 'Residency', type: 'text' }]),
      entitySchema('data-entity', [
        { id: 'permitted_regions', name: 'Permitted regions', type: 'text' }
      ])
    ];
    const relation = relationRow({ dest_region: 'us', assets: ['asset-1'] });
    const rSchema = relationSchema([
      textField('dest_region'),
      entityRelationField('assets', 'data-entity')
    ]);

    const projection = buildRelationProjection(relation, entities, schemas, [relation], [rSchema], {
      depth: 1
    });

    expect(projection.dest_region).toBe('us');
    expect((projection._in as Record<string, unknown>).residency).toBe('eu');
    expect((projection._out as Record<string, unknown>).residency).toBe('us');
    expect(projection.assets).toEqual([expect.objectContaining({ permitted_regions: ['eu'] })]);
  });
});

describe('relation derived recalculation', () => {
  const buildDb = (
    entities: EntityDbResult[],
    schemas: SchemaDbResult[],
    relations: RelationDbResult[],
    relationSchemas: RelationSchemaDbResult[]
  ) =>
    ({
      catalog: {
        listEntities: async () => entities,
        listSchemas: async () => schemas,
        updateEntityDerivedFields: async (
          _ws: string,
          id: string,
          data: Record<string, unknown>
        ) => {
          entities.find(e => e.id === id)!.data = data;
        }
      },
      relation: {
        listRelationsForEntities: async () => ({ outgoing: relations, incoming: [] }),
        listRelationSchemas: async () => relationSchemas,
        updateRelationDerivedFields: async (
          _ws: string,
          id: string,
          data: Record<string, unknown>
        ) => {
          relations.find(r => r.id === id)!.data = data;
        }
      }
    }) as unknown as DatabaseAdapter;

  it('re-materializes when an endpoint entity field changes', async () => {
    const entities = [
      entity('system-a', 'system', { residency: 'eu' }),
      entity('system-b', 'system', { residency: 'eu' })
    ];
    const schemas = [
      entitySchema('system', [{ id: 'residency', name: 'Residency', type: 'text' }])
    ];
    const relations = [relationRow({})];
    const rSchema = relationSchema([
      derivedField(
        'cross_boundary',
        "relation._in.residency == relation._out.residency ? 'no' : 'yes'"
      )
    ]);
    const db = buildDb(entities, schemas, relations, [rSchema]);

    await recalculateEntityDerivedFields(db, 'workspace-1', ['system-a']);
    expect(relations[0]!.data.cross_boundary).toBe('no');

    entities[1]!.data.residency = 'us';
    await recalculateEntityDerivedFields(db, 'workspace-1', ['system-b']);
    expect(relations[0]!.data.cross_boundary).toBe('yes');
  });

  it('re-materializes when a carried entityRelation entity field changes', async () => {
    const entities = [
      entity('system-a', 'system', {}),
      entity('system-b', 'system', {}),
      entity('asset-1', 'data-entity', { permitted_regions: ['eu'] })
    ];
    const schemas = [
      entitySchema('system', []),
      entitySchema('data-entity', [
        { id: 'permitted_regions', name: 'Permitted regions', type: 'text' }
      ])
    ];
    const relations = [relationRow({ dest_region: 'eu', assets: ['asset-1'] })];
    const rSchema = relationSchema([
      textField('dest_region'),
      entityRelationField('assets', 'data-entity'),
      derivedField(
        'permitted_count',
        'relation.assets.map(.permitted_regions) |> flatten |> count',
        undefined,
        'number'
      )
    ]);
    const db = buildDb(entities, schemas, relations, [rSchema]);

    await recalculateEntityDerivedFields(db, 'workspace-1', ['asset-1']);
    expect(relations[0]!.data.permitted_count).toBe(1);

    entities[2]!.data.permitted_regions = ['us', 'eu'];
    await recalculateEntityDerivedFields(db, 'workspace-1', ['asset-1']);
    expect(relations[0]!.data.permitted_count).toBe(2);
  });
});
