import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import {
  buildEntityGrantInputs,
  buildEntityDependents,
  buildEntityRelations,
  filterEntities,
  getEntityParentsFromPayload,
  matchesFilterCondition,
  parseEntityMutationPayload,
  resolveCreateOwner
} from './dataHelpers';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');

const enriched = (
  e: Omit<
    EntityDbResult,
    'owner_name' | 'lifecycle_label' | 'target_lifecycle_label' | 'schema_name' | 'completeness'
  >
): EntityDbResult => ({
  ...e,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: '',
  completeness: 0
});

const domainSchema: SchemaDbResult = {
  id: 'schema-domain',
  workspace: 'default',
  name: 'Domain',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'DOM',
  created_at: now,
  updated_at: now
};

const systemSchema: SchemaDbResult = {
  id: 'schema-system',
  workspace: 'default',
  name: 'System',
  description: '',
  fields: [
    {
      id: 'domain',
      name: 'Domain',
      type: 'containment',
      predicate: 'belongs to',
      schemaId: 'schema-domain',
      minCount: 1,
      maxCount: 1
    }
  ],
  color: null,
  icon: null,
  default_owner: 'Design Systems',
  key_prefix: 'SYS',
  created_at: now,
  updated_at: now
};

const componentSchema: SchemaDbResult = {
  id: 'schema-component',
  workspace: 'default',
  name: 'Component',
  description: '',
  fields: [
    {
      id: 'system',
      name: 'System',
      type: 'containment',
      predicate: 'belongs to',
      schemaId: 'schema-system',
      minCount: 1,
      maxCount: 1
    },
    {
      id: 'depends_on',
      name: 'Depends On',
      type: 'reference',
      predicate: 'depends on',
      schemaId: 'schema-component',
      minCount: 0,
      maxCount: -1,
      groupId: 'restricted'
    }
  ],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-allowed'] } }],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'CMP',
  created_at: now,
  updated_at: now
};

const domain: EntityDbResult = enriched({
  id: 'domain-1',
  workspace: 'default',
  public_id: 'DOM-1',
  slug: 'engineering',
  namespace: 'default',
  name: 'Engineering',
  description: 'Core domain',
  owner: 'Platform Engineering',
  lifecycle: 'production',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['core'],
  links: [],
  schema_id: 'schema-domain',
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now
});

const system: EntityDbResult = enriched({
  id: 'system-1',
  workspace: 'default',
  public_id: 'SYS-1',
  slug: 'customer-portal',
  namespace: 'default',
  name: 'Customer Portal',
  description: 'Portal',
  owner: 'Design Systems',
  lifecycle: 'production',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['frontend'],
  links: [],
  schema_id: 'schema-system',
  data: { domain: ['domain-1'] },
  project_id: null,
  created_at: now,
  updated_at: now
});

const component: EntityDbResult = enriched({
  id: 'component-1',
  workspace: 'default',
  public_id: 'CMP-1',
  slug: 'frontend-app',
  namespace: 'default',
  name: 'Frontend App',
  description: 'SPA',
  owner: 'Design Systems',
  lifecycle: 'production',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['react'],
  links: [],
  schema_id: 'schema-component',
  data: { system: ['system-1'], depends_on: ['component-2'] },
  project_id: null,
  created_at: now,
  updated_at: now
});

const dependency: EntityDbResult = enriched({
  id: 'component-2',
  workspace: 'default',
  public_id: 'CMP-2',
  slug: 'api-gateway',
  namespace: 'default',
  name: 'API Gateway',
  description: 'Gateway',
  owner: 'Platform Engineering',
  lifecycle: 'production',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['nodejs'],
  links: [],
  schema_id: 'schema-component',
  data: { system: ['system-1'] },
  project_id: null,
  created_at: now,
  updated_at: now
});

describe('data route helpers', () => {
  const restrictedAuthCtx = buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: 'editor',
    teamAssignments: [],
    schemas: [],
    entities: [],
    grants: []
  });
  const allowedAuthCtx = buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: 'editor',
    teamAssignments: [{ teamId: 'team-allowed', role: 'team_editor' }],
    schemas: [],
    entities: [],
    grants: []
  });

  it('parses mutation payloads with defaults and derived slug', () => {
    expect(
      parseEntityMutationPayload({
        _schemaId: 'schema-component',
        name: 'Frontend App',
        _description: 42,
        _owner: 'Design Systems',
        _lifecycle: 'production',
        _tags: ['react', 1],
        _links: 'invalid',
        _projectId: 'project-1',
        system: ['system-1']
      })
    ).toEqual({
      schemaId: 'schema-component',
      name: 'Frontend App',
      slug: 'frontend-app',
      namespace: 'default',
      description: '',
      requestedOwner: 'Design Systems',
      requestedLifecycle: 'production',
      requestedTargetLifecycle: null,
      requestedTargetLifecycleDate: null,
      tags: ['react'],
      links: [],
      projectId: 'project-1',
      external: null,
      fields: { system: ['system-1'] },
      relations: {}
    });
  });

  it('treats empty owner and lifecycle references as unset', () => {
    expect(
      parseEntityMutationPayload({
        _schemaId: 'schema-component',
        _name: 'Frontend App',
        _owner: '',
        _lifecycle: '  ',
        _targetLifecycle: ''
      })
    ).toMatchObject({
      requestedOwner: null,
      requestedLifecycle: null,
      requestedTargetLifecycle: null
    });
  });

  it('resolves create owner by explicit owner, inherited parent, schema default, and fallback', () => {
    const teamIds = new Set(['Platform Engineering', 'Design Systems']);
    expect(resolveCreateOwner('Design Systems', [domain], systemSchema, teamIds, null)).toBe(
      'Design Systems'
    );
    expect(resolveCreateOwner(null, [domain], systemSchema, teamIds, null)).toBe(
      'Platform Engineering'
    );
    expect(resolveCreateOwner(null, [], systemSchema, teamIds, null)).toBe('Design Systems');
    expect(resolveCreateOwner(null, [], domainSchema, teamIds, 'Platform Engineering')).toBe(
      'Platform Engineering'
    );
  });

  it('extracts parent entities from containment fields in the payload', () => {
    const parents = getEntityParentsFromPayload(
      componentSchema,
      { system: 'system-1,missing,parent-2' },
      new Map([
        ['system-1', system],
        ['parent-2', dependency]
      ])
    );

    expect(parents.map(parent => parent.id)).toEqual(['system-1', 'component-2']);
  });

  it('filters entities by schema, owner, lifecycle, and search query', () => {
    const result = filterEntities([domain, system, component, dependency], {
      schemaId: 'schema-component',
      owner: 'Design Systems',
      lifecycle: 'production',
      q: 'react'
    });

    expect(result.map(entity => entity.id)).toEqual(['component-1']);
  });

  it('matches _tags filter conditions against any tag', () => {
    expect(
      matchesFilterCondition(component, { fieldId: '_tags', op: 'equals', value: 'react' }, null)
    ).toBe(true);
    expect(
      matchesFilterCondition(component, { fieldId: '_tags', op: 'equals', value: 'frontend' }, null)
    ).toBe(false);
    expect(
      matchesFilterCondition(
        component,
        { fieldId: '_tags', op: 'not_equals', value: 'react' },
        null
      )
    ).toBe(false);
    expect(
      matchesFilterCondition(system, { fieldId: '_tags', op: 'not_equals', value: 'react' }, null)
    ).toBe(true);
    expect(
      matchesFilterCondition(component, { fieldId: '_tags', op: 'contains', value: 'EAC' }, null)
    ).toBe(true);
    expect(
      matchesFilterCondition(component, { fieldId: '_tags', op: 'empty', value: '' }, null)
    ).toBe(false);
    expect(
      matchesFilterCondition(component, { fieldId: '_tags', op: 'not_empty', value: '' }, null)
    ).toBe(true);
    expect(
      matchesFilterCondition(
        { ...component, tags: [] },
        { fieldId: '_tags', op: 'empty', value: '' },
        null
      )
    ).toBe(true);
  });

  it('builds incoming and outgoing relations for an entity', () => {
    const relations = buildEntityRelations(
      component,
      [domainSchema, systemSchema, componentSchema],
      [domain, system, component, dependency],
      null
    );

    expect(relations.outgoing).toEqual([
      {
        entityId: 'system-1',
        publicId: 'SYS-1',
        entitySlug: 'customer-portal',
        entityName: 'Customer Portal',
        entitySchemaId: 'schema-system',
        fieldName: 'System',
        fieldPredicate: 'belongs to',
        kind: 'containment'
      },
      {
        entityId: 'component-2',
        publicId: 'CMP-2',
        entitySlug: 'api-gateway',
        entityName: 'API Gateway',
        entitySchemaId: 'schema-component',
        fieldName: 'Depends On',
        fieldPredicate: 'depends on',
        kind: 'reference'
      }
    ]);
    expect(relations.incoming).toEqual([]);
  });

  it('omits restricted outgoing and incoming relation fields', () => {
    const relations = buildEntityRelations(
      component,
      [domainSchema, systemSchema, componentSchema],
      [domain, system, component, dependency],
      restrictedAuthCtx
    );

    expect(relations.outgoing.map(relation => relation.entityId)).toEqual(['system-1']);
    expect(relations.incoming).toEqual([]);

    const allowed = buildEntityRelations(
      component,
      [domainSchema, systemSchema, componentSchema],
      [domain, system, component, dependency],
      allowedAuthCtx
    );
    expect(allowed.outgoing.map(relation => relation.entityId)).toEqual([
      'system-1',
      'component-2'
    ]);
  });

  const dataFlowRelationSchema: RelationSchemaDbResult = {
    id: 'relschema-dataflow',
    workspace: 'default',
    name: 'Data Flow',
    description: 'reads/writes',
    in_schema_ids: ['schema-component'],
    out_schema_ids: ['schema-component'],
    fields: [
      {
        id: 'protocol',
        name: 'Protocol',
        type: 'text',
        requirementLevel: 'optional',
        groupId: 'restricted'
      }
    ],
    groups: [
      { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-allowed'] } }
    ],
    shared_field_group_links: [],
    color: '#00ff00',
    icon: 'flow',
    relation_approval_policy: 'disabled',
    version: 1,
    created_at: now,
    updated_at: now
  };

  const visibleRelationRow: RelationDbResult = {
    id: 'relation-1',
    workspace: 'default',
    schema_id: 'relschema-dataflow',
    schema_name: 'Data Flow',
    in_entity_id: 'component-1',
    in_entity_name: 'Frontend App',
    out_entity_id: 'component-2',
    out_entity_name: 'API Gateway',
    data: { protocol: 'https' },
    version: 1,
    approval_policy_override: null,
    created_at: now,
    updated_at: now
  };

  const hiddenRelationRow: RelationDbResult = {
    ...visibleRelationRow,
    id: 'relation-2',
    out_entity_id: 'component-999',
    out_entity_name: 'Ghost Service'
  };

  it('merges typed relation instances into outgoing, redacting restricted fields', () => {
    const relations = buildEntityRelations(
      component,
      [domainSchema, systemSchema, componentSchema],
      [domain, system, component, dependency],
      restrictedAuthCtx,
      { outgoing: [visibleRelationRow], incoming: [] },
      [dataFlowRelationSchema]
    );

    // system-1 (containment) + the typed relation; depends_on (reference) stays restricted
    expect(relations.outgoing.map(relation => relation.entityId)).toEqual([
      'system-1',
      'component-2'
    ]);
    const typed = relations.outgoing.find(relation => relation.kind === 'typed');
    expect(typed).toMatchObject({
      entityId: 'component-2',
      entityName: 'API Gateway',
      entitySchemaId: 'schema-component',
      fieldName: 'Data Flow',
      kind: 'typed',
      relationId: 'relation-1',
      relationSchemaId: 'relschema-dataflow',
      relationSchemaColor: '#00ff00',
      relationSchemaIcon: 'flow'
    });
    // protocol is in the team-restricted group, and restrictedAuthCtx lacks team-allowed
    expect(typed!.relationFields).toEqual({});
  });

  it('includes typed relation instance fields once the caller can view the relation schema group', () => {
    const relations = buildEntityRelations(
      component,
      [domainSchema, systemSchema, componentSchema],
      [domain, system, component, dependency],
      allowedAuthCtx,
      { outgoing: [visibleRelationRow], incoming: [] },
      [dataFlowRelationSchema]
    );

    const typed = relations.outgoing.find(relation => relation.kind === 'typed');
    expect(typed!.relationFields).toEqual({ protocol: 'https' });
  });

  it('drops typed relations whose other endpoint entity is not in the visible entity set', () => {
    const relations = buildEntityRelations(
      component,
      [domainSchema, systemSchema, componentSchema],
      [domain, system, component, dependency],
      allowedAuthCtx,
      { outgoing: [visibleRelationRow, hiddenRelationRow], incoming: [] },
      [dataFlowRelationSchema]
    );

    expect(relations.outgoing.some(relation => relation.relationId === 'relation-2')).toBe(false);
    expect(relations.outgoing.filter(relation => relation.kind === 'typed')).toHaveLength(1);
  });

  it('does not traverse dependents through a restricted relation field', () => {
    const restricted = buildEntityDependents(
      dependency.id,
      [domain, system, component, dependency],
      [domainSchema, systemSchema, componentSchema],
      { transitive: true },
      restrictedAuthCtx
    );
    expect(restricted.dependents).toEqual([]);

    const allowed = buildEntityDependents(
      dependency.id,
      [domain, system, component, dependency],
      [domainSchema, systemSchema, componentSchema],
      { transitive: true },
      allowedAuthCtx
    );
    expect(allowed.dependents.map(dependent => dependent.entityId)).toEqual(['component-1']);
  });

  it('builds validated entity grant inputs', () => {
    expect(
      buildEntityGrantInputs(
        'default',
        'entity-1',
        [
          {
            principal_type: 'team',
            principal_id: 'Design Systems',
            role: 'editor',
            applies_to: 'subtree'
          }
        ],
        now,
        () => 'grant-1'
      )
    ).toEqual([
      {
        id: 'grant-1',
        workspace: 'default',
        entity_id: 'entity-1',
        principal_type: 'team',
        principal_id: 'Design Systems',
        role: 'editor',
        applies_to: 'subtree',
        created_at: now
      }
    ]);
  });

  it('rejects invalid entity grant inputs', () => {
    expect(() =>
      buildEntityGrantInputs(
        'default',
        'entity-1',
        [
          {
            principal_type: 'service',
            principal_id: 'svc-1',
            role: 'editor',
            applies_to: 'self'
          }
        ],
        now
      )
    ).toThrow('principal_type must be user or team');
  });
});
