import { describe, expect, it } from 'vitest';
import {
  toDiagramCraftData,
  toDiagramCraftField,
  toDiagramCraftRelationReferences,
  toDiagramCraftSchema
} from './diagramCraftTransforms';
import { Entity, SchemaDbResult, WorkspaceEnumDbResult } from '../catalog/db/catalogDatabase';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';

const authCtxWithTeamRoles = (roles: Record<string, TeamRole[]>) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: Object.entries(roles).flatMap(([teamId, teamRoles]) =>
      teamRoles.map(role => ({ teamId, role }))
    ),
    schemas: [],
    entities: [],
    grants: []
  });

describe('diagram craft transforms', () => {
  it('keeps containment fields in diagram craft schema responses', () => {
    const schema = {
      id: 'schema-1',
      name: 'System',
      fields: [
        {
          id: 'system',
          name: 'System',
          predicate: 'belongs to',
          type: 'containment',
          schemaId: 'schema-2'
        },
        {
          id: 'depends_on',
          name: 'Depends on',
          predicate: 'depends on',
          type: 'reference',
          schemaId: 'schema-2'
        }
      ]
    } as SchemaDbResult;

    expect(toDiagramCraftSchema(schema, [])).toEqual({
      id: 'schema-1',
      name: 'System',
      fields: [
        { id: 'name', name: 'Name', type: 'text' },
        { id: 'description', name: 'Description', type: 'longtext' },
        {
          id: 'system',
          name: 'System',
          predicate: 'belongs to',
          type: 'containment',
          schemaId: 'schema-2'
        },
        {
          id: 'depends_on',
          name: 'Depends on',
          predicate: 'depends on',
          type: 'reference',
          schemaId: 'schema-2'
        }
      ]
    });
  });

  it('projects typed relation fields to multi-target references', () => {
    const relationSchema = {
      id: 'relation-1',
      in_schema_ids: ['schema-1'],
      out_schema_ids: ['schema-2', 'schema-3']
    } as never;
    const schema = {
      id: 'schema-1',
      name: 'Source',
      fields: [
        {
          id: 'flows_to',
          name: 'Flows to',
          type: 'typedRelation',
          relationSchemaId: 'relation-1',
          direction: 'in'
        }
      ]
    } as SchemaDbResult;

    expect(toDiagramCraftSchema(schema, [], [relationSchema]).fields).toContainEqual({
      id: 'flows_to',
      name: 'Flows to',
      type: 'reference',
      schemaId: 'schema-2',
      schemaIds: ['schema-2', 'schema-3'],
      minCount: 0,
      maxCount: -1
    });
  });

  it('projects visible typed relation endpoints without relation attributes', () => {
    const source = {
      id: 'source',
      schema_id: 'schema-1',
      name: 'Source'
    } as Entity;
    const target = {
      id: 'target',
      schema_id: 'schema-2',
      name: 'Target'
    } as Entity;
    const schemas = [
      {
        id: 'schema-1',
        fields: [
          {
            id: 'flows_to',
            name: 'Flows to',
            type: 'typedRelation',
            relationSchemaId: 'relation-1',
            direction: 'in'
          }
        ]
      },
      { id: 'schema-2', fields: [] }
    ] as SchemaDbResult[];
    const row = {
      id: 'relation-instance',
      schema_id: 'relation-1',
      in_entity_id: 'source',
      out_entity_id: 'target',
      data: { classification: 'PII' }
    } as never;

    const references = toDiagramCraftRelationReferences(
      [row],
      [source, target],
      schemas,
      authCtxWithTeamRoles({})
    );

    expect(references).toEqual(new Map([['source', new Map([['flows_to', ['target']]])]]));
    expect(toDiagramCraftData(source, schemas[0]!, null, references.get('source'))).toMatchObject({
      flows_to: 'target'
    });
    expect(
      toDiagramCraftData(source, schemas[0]!, null, references.get('source'))
    ).not.toHaveProperty('classification');
  });

  it('redacts restricted duplicate typed relation bindings individually', () => {
    const source = {
      id: 'source',
      schema_id: 'schema-1',
      name: 'Source'
    } as Entity;
    const target = {
      id: 'target',
      schema_id: 'schema-2',
      name: 'Target'
    } as Entity;
    const schemas = [
      {
        id: 'schema-1',
        fields: [
          {
            id: 'flows_to_visible',
            name: 'Flows to',
            type: 'typedRelation',
            relationSchemaId: 'relation-1',
            direction: 'in'
          },
          {
            id: 'flows_to_restricted',
            name: 'Restricted flows to',
            type: 'typedRelation',
            relationSchemaId: 'relation-1',
            direction: 'in',
            groupId: 'restricted'
          }
        ],
        groups: [
          {
            id: 'restricted',
            name: 'Restricted',
            accessControl: { teamIds: ['team-restricted'] }
          }
        ]
      },
      { id: 'schema-2', fields: [], groups: [] }
    ] as SchemaDbResult[];
    const row = {
      id: 'relation-instance',
      schema_id: 'relation-1',
      in_entity_id: 'source',
      out_entity_id: 'target',
      data: {}
    } as never;
    const authCtx = authCtxWithTeamRoles({});

    const references = toDiagramCraftRelationReferences(
      [row],
      [source, target],
      schemas,
      authCtx
    );

    expect(references).toEqual(
      new Map([['source', new Map([['flows_to_visible', ['target']]])]])
    );

    const result = toDiagramCraftData(
      source,
      schemas[0]!,
      authCtx,
      new Map([
        ['flows_to_visible', [target.id]],
        ['flows_to_restricted', [target.id]]
      ])
    );

    expect(result).toMatchObject({ flows_to_visible: target.id });
    expect(result).not.toHaveProperty('flows_to_restricted');
  });

  it('omits relation edges when one endpoint schema is unavailable', () => {
    const source = {
      id: 'source',
      schema_id: 'missing-schema',
      name: 'Source'
    } as Entity;
    const target = {
      id: 'target',
      schema_id: 'schema-2',
      name: 'Target'
    } as Entity;
    const schemas = [{ id: 'schema-2', fields: [] }] as unknown as SchemaDbResult[];
    const row = {
      id: 'relation-instance',
      schema_id: 'relation-1',
      in_entity_id: 'source',
      out_entity_id: 'target',
      data: {}
    } as never;

    expect(
      toDiagramCraftRelationReferences([row], [source, target], schemas, authCtxWithTeamRoles({}))
    ).toEqual(new Map());
  });

  it('adds name and description metadata fields when missing', () => {
    const schema = {
      id: 'schema-1',
      name: 'Component',
      fields: [{ id: 'technology', name: 'Technology', type: 'text' }]
    } as SchemaDbResult;

    expect(toDiagramCraftSchema(schema, []).fields).toEqual([
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'description', name: 'Description', type: 'longtext' },
      { id: 'technology', name: 'Technology', type: 'text' }
    ]);
  });

  it('keeps date fields in diagram craft schema output', () => {
    expect(
      toDiagramCraftField({ id: 'go_live', name: 'Go Live', type: 'date' } as never, [])
    ).toEqual({
      id: 'go_live',
      name: 'Go Live',
      type: 'date'
    });
  });

  it('populates select field options from enums', () => {
    const enumId = 'enum-1';
    const enums: WorkspaceEnumDbResult[] = [
      {
        id: enumId,
        workspace: 'ws-1',
        name: 'My Enum',
        options: [
          { value: 'v1', label: 'L1' },
          { value: 'v2', label: 'L2' }
        ],
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    const field = {
      id: 'choice',
      name: 'Choice',
      type: 'select',
      enumId: enumId
    } as any;

    expect(toDiagramCraftField(field, enums)).toEqual({
      id: 'choice',
      name: 'Choice',
      type: 'select',
      enumId: enumId,
      options: [
        { value: 'v1', label: 'L1' },
        { value: 'v2', label: 'L2' }
      ]
    });
  });

  it('projects entity rows to diagram craft data responses', () => {
    const row = {
      id: 'entity-1',
      workspace: 'default',
      schema_id: 'schema-1',
      name: 'Frontend App',
      slug: 'frontend-app',
      namespace: 'default',
      description: 'React SPA',
      owner: 'Design Systems',
      lifecycle: 'production',
      tags: ['react'],
      links: [],
      project_id: null,
      created_at: new Date('2026-06-06T00:00:00.000Z'),
      updated_at: new Date('2026-06-06T00:00:00.000Z'),
      data: {
        technology: 'React',
        system: 'system-1'
      }
    } as unknown as Entity;

    expect(toDiagramCraftData(row, null, null)).toEqual({
      _uid: 'entity-1',
      _workspace: 'default',
      _schemaId: 'schema-1',
      _name: 'Frontend App',
      _slug: 'frontend-app',
      _namespace: 'default',
      _description: 'React SPA',
      _owner: 'Design Systems',
      _lifecycle: 'production',
      _tags: ['react'],
      _links: [],
      _projectId: null,
      name: 'Frontend App',
      description: 'React SPA',
      technology: 'React',
      system: 'system-1'
    });
  });

  it('omits fields in restricted groups from diagram craft data responses', () => {
    const row = {
      id: 'entity-1',
      workspace: 'default',
      schema_id: 'schema-1',
      name: 'Frontend App',
      slug: 'frontend-app',
      namespace: 'default',
      description: 'React SPA',
      owner: 'Design Systems',
      lifecycle: 'production',
      tags: ['react'],
      links: [],
      project_id: null,
      created_at: new Date('2026-06-06T00:00:00.000Z'),
      updated_at: new Date('2026-06-06T00:00:00.000Z'),
      data: {
        technology: 'React',
        secret: 'confidential'
      }
    } as unknown as Entity;

    const schema: FieldGroupSchemaShape = {
      fields: [
        { id: 'technology', name: 'Technology', type: 'text' } as never,
        {
          id: 'secret',
          name: 'Secret',
          type: 'text',
          groupId: 'restricted'
        } as never
      ],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ]
    };

    const result = toDiagramCraftData(row, schema, authCtxWithTeamRoles({}));

    expect(result.technology).toBe('React');
    expect(result.secret).toBeUndefined();
  });

  it('fails closed for missing schemas and stale field keys', () => {
    const row = {
      id: 'entity-1',
      workspace: 'default',
      schema_id: 'schema-1',
      name: 'Frontend App',
      slug: 'frontend-app',
      namespace: 'default',
      description: 'React SPA',
      owner: null,
      lifecycle: null,
      tags: [],
      links: [],
      project_id: null,
      data: { technology: 'React', stale: 'secret' }
    } as unknown as Entity;

    expect(toDiagramCraftData(row, null, authCtxWithTeamRoles({}))).not.toHaveProperty(
      'technology'
    );
    expect(
      toDiagramCraftData(
        row,
        { fields: [{ id: 'technology', name: 'Technology', type: 'text' }], groups: [] },
        authCtxWithTeamRoles({})
      )
    ).toMatchObject({ technology: 'React' });
    expect(
      toDiagramCraftData(
        row,
        { fields: [{ id: 'technology', name: 'Technology', type: 'text' }], groups: [] },
        authCtxWithTeamRoles({})
      )
    ).not.toHaveProperty('stale');
  });
});
