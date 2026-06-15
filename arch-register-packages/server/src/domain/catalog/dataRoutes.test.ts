import { describe, expect, it } from 'vitest';
import {
  buildEntityGrantInputs,
  buildEntityRelations,
  filterEntities,
  getEntityParentsFromPayload,
  parseEntityMutationPayload,
  resolveCreateOwner
} from './dataHelpers';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');

const enriched = (
  e: Omit<
    EntityDbResult,
    'owner_name' | 'lifecycle_label' | 'target_lifecycle_label' | 'schema_name'
  >
): EntityDbResult => ({
  ...e,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: ''
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
      schemaId: 'schema-domain',
      minCount: 1,
      maxCount: 1
    }
  ],
  color: null,
  icon: null,
  default_owner: 'Design Systems',
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
      schemaId: 'schema-system',
      minCount: 1,
      maxCount: 1
    },
    {
      id: 'depends_on',
      name: 'Depends On',
      type: 'reference',
      schemaId: 'schema-component',
      minCount: 0,
      maxCount: -1
    }
  ],
  color: null,
  icon: null,
  default_owner: null,
  created_at: now,
  updated_at: now
};

const domain: EntityDbResult = enriched({
  id: 'domain-1',
  workspace: 'default',
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
  visibility_mode: null,
  created_at: now,
  updated_at: now
});

const system: EntityDbResult = enriched({
  id: 'system-1',
  workspace: 'default',
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
  data: { domain: 'domain-1' },
  visibility_mode: null,
  created_at: now,
  updated_at: now
});

const component: EntityDbResult = enriched({
  id: 'component-1',
  workspace: 'default',
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
  data: { system: 'system-1', depends_on: 'component-2' },
  visibility_mode: null,
  created_at: now,
  updated_at: now
});

const dependency: EntityDbResult = enriched({
  id: 'component-2',
  workspace: 'default',
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
  data: { system: 'system-1' },
  visibility_mode: null,
  created_at: now,
  updated_at: now
});

describe('data route helpers', () => {
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
        _visibilityMode: 'public',
        system: 'system-1'
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
      visibilityMode: 'public',
      fields: { system: 'system-1' }
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

  it('builds incoming and outgoing relations for an entity', () => {
    const relations = buildEntityRelations(
      component,
      [domainSchema, systemSchema, componentSchema],
      [domain, system, component, dependency]
    );

    expect(relations.outgoing).toEqual([
      {
        entityId: 'system-1',
        publicId: 'system-1',
        entitySlug: 'customer-portal',
        entityName: 'Customer Portal',
        entitySchemaId: 'schema-system',
        fieldName: 'System',
        kind: 'containment'
      },
      {
        entityId: 'component-2',
        publicId: 'component-2',
        entitySlug: 'api-gateway',
        entityName: 'API Gateway',
        entitySchemaId: 'schema-component',
        fieldName: 'Depends On',
        kind: 'reference'
      }
    ]);
    expect(relations.incoming).toEqual([]);
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
