import { describe, expect, it } from 'vitest';
import type { ValidationRule } from '@arch-register/api-types/schemaContract';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import {
  evaluateValidationRules,
  normalizeValidationRules,
  buildValidationPlan,
  validateEntityGraph
} from './entityValidationRules';

const rule = (overrides: Partial<ValidationRule> = {}): ValidationRule => ({
  id: 'valid-status',
  name: 'Valid status',
  expression: "entity.status == 'active'",
  message: 'Status must be active',
  severity: 'error',
  active: true,
  ...overrides
});

const entity = (
  id: string,
  schemaId: string,
  name: string,
  data: Record<string, unknown>
): EntityDbResult =>
  ({
    id,
    workspace: 'ws-1',
    public_id: id,
    slug: id,
    namespace: 'default',
    name,
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
    created_at: new Date(0),
    updated_at: new Date(0),
    owner_name: null,
    lifecycle_label: null,
    target_lifecycle_label: null,
    schema_name: schemaId,
    completeness: 0
  }) as EntityDbResult;

describe('entity validation rules', () => {
  it('normalizes rules and evaluates them against the depth-1 projection', () => {
    const rules = normalizeValidationRules(
      [{ ...rule(), fieldId: 'status' }],
      [{ id: 'status', name: 'Status', type: 'text' }]
    );

    expect(
      evaluateValidationRules(
        rules,
        { status: 'retired', metadata: { id: 'e-1' } },
        {
          id: 'e-1',
          schemaId: 'service',
          schemaVersion: 3
        }
      )
    ).toMatchObject({
      entityId: 'e-1',
      schemaVersion: 3,
      errors: [{ ruleId: 'valid-status', fieldId: 'status', message: 'Status must be active' }]
    });
  });

  it('keeps warnings separate and skips inactive rules', () => {
    const result = evaluateValidationRules(
      [
        rule({ id: 'warning', severity: 'warning' }),
        rule({ id: 'inactive', active: false, message: 'should not appear' })
      ],
      { status: 'retired' },
      { id: 'e-1', schemaId: 'service', schemaVersion: 1 }
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.ruleId).toBe('warning');
  });

  it('rejects expressions that use identifiers outside entity', () => {
    expect(() => buildValidationPlan([rule({ expression: 'status == active' })])).toThrow(
      'may only reference fields through entity'
    );
  });

  it('turns evaluation failures into blocking diagnostics', () => {
    const result = evaluateValidationRules(
      [rule({ expression: 'entity.status' })],
      { status: null },
      { id: 'e-1', schemaId: 'service', schemaVersion: 1 }
    );

    expect(result.errors).toMatchObject([
      { severity: 'error', message: "Validation rule 'Valid status' did not return a boolean" }
    ]);
  });

  it('evaluates typed relation rules with the relation root', () => {
    const result = evaluateValidationRules(
      [
        {
          id: 'positive-weight',
          name: 'Positive weight',
          expression: 'relation.weight > 0',
          message: 'Weight must be positive',
          severity: 'error',
          active: true
        }
      ],
      { weight: 0, in: { metadata: { id: 'in-1' } }, out: { metadata: { id: 'out-1' } } },
      { id: 'relation-1', schemaId: 'depends-on', schemaVersion: 2 },
      'relation'
    );

    expect(result).toMatchObject({
      relationId: 'relation-1',
      errors: [{ ruleId: 'positive-weight', message: 'Weight must be positive' }]
    });
  });

  it('validates direct dependents against the changed entity projection', async () => {
    const source = entity('source-1', 'source', 'Renamed source', {});
    const dependent = entity('dependent-1', 'dependent', 'Dependent', {
      source: ['source-1']
    });
    const schemas: SchemaDbResult[] = [
      {
        id: 'source',
        workspace: 'ws-1',
        name: 'Source',
        description: '',
        fields: [],
        validation_rules: [],
        groups: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: 'SRC',
        created_at: new Date(0),
        updated_at: new Date(0)
      },
      {
        id: 'dependent',
        workspace: 'ws-1',
        name: 'Dependent',
        description: '',
        fields: [
          {
            id: 'source',
            name: 'Source',
            type: 'reference',
            schemaId: 'source',
            minCount: 0,
            maxCount: 1
          }
        ],
        validation_rules: [
          rule({
            id: 'source-name',
            expression: "entity.source.metadata.name == 'Source'",
            message: 'Source name must remain Source'
          })
        ],
        groups: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: 'DEP',
        created_at: new Date(0),
        updated_at: new Date(0)
      }
    ];
    const db = {
      catalog: {
        listEntities: async () => [source, dependent],
        listSchemas: async () => schemas
      },
      relation: {
        listRelationsForEntities: async () => ({ outgoing: [], incoming: [] }),
        listRelationSchemas: async () => []
      }
    } as unknown as DatabaseAdapter;

    const summary = await validateEntityGraph(db, 'ws-1', ['source-1']);
    expect(summary.errors).toMatchObject([
      { entityId: 'dependent-1', ruleId: 'source-name', message: 'Source name must remain Source' }
    ]);
  });

  it('validates typed relations affected by an entity save', async () => {
    const source = entity('source-1', 'source', 'Source', {});
    const target = entity('target-1', 'target', 'Target', {});
    const schemas: SchemaDbResult[] = [
      ...['source', 'target'].map(id => ({
        id,
        workspace: 'ws-1',
        name: id,
        description: '',
        fields: [],
        groups: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: id.slice(0, 3).toUpperCase(),
        created_at: new Date(0),
        updated_at: new Date(0)
      }))
    ] as SchemaDbResult[];
    const relation = {
      id: 'relation-1',
      workspace: 'ws-1',
      schema_id: 'depends-on',
      schema_name: 'Depends on',
      in_entity_id: source.id,
      in_entity_name: source.name,
      out_entity_id: target.id,
      out_entity_name: target.name,
      data: { weight: 0 },
      owner: null,
      owner_name: null,
      lifecycle: null,
      lifecycle_label: null,
      version: 1,
      approval_policy_override: null,
      created_at: new Date(0),
      updated_at: new Date(0)
    };
    const db = {
      catalog: {
        listEntities: async () => [source, target],
        listSchemas: async () => schemas
      },
      relation: {
        listRelationsForEntities: async () => ({ outgoing: [relation], incoming: [] }),
        listRelationSchemas: async () => [
          {
            id: 'depends-on',
            workspace: 'ws-1',
            name: 'Depends on',
            description: '',
            in_schema_ids: 'any',
            out_schema_ids: 'any',
            fields: [],
            groups: [],
            validation_rules: [
              {
                id: 'positive-weight',
                name: 'Positive weight',
                expression: 'relation.weight > 0',
                message: 'Weight must be positive',
                severity: 'error',
                active: true
              }
            ],
            color: null,
            icon: null,
            version: 1,
            created_at: new Date(0),
            updated_at: new Date(0)
          }
        ]
      }
    } as unknown as DatabaseAdapter;

    const summary = await validateEntityGraph(db, 'ws-1', ['source-1']);
    expect(summary.relationResults).toHaveLength(1);
    expect(summary.errors).toMatchObject([{ relationId: 'relation-1', ruleId: 'positive-weight' }]);
  });
});
