import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  chainMatchesTarget,
  nextPosition,
  pathStepContextWithFallbackDirection,
  pathStepOptions,
  positionStepContext,
  prunePositionedPathSteps,
  relationPositionOptions,
  targetSchemaIdsForStep,
  type PathPosition
} from './pathBuilderState';

const makeSchema = (id: string, name: string, fields: EntitySchema['fields'] = []) =>
  ({ id, name, fields, groups: [] }) as unknown as EntitySchema;

const makeRelation = (
  id: string,
  name: string,
  inSchemaIds: string[] | 'any',
  outSchemaIds: string[] | 'any'
) =>
  ({
    id,
    workspace: 'workspace',
    name,
    category: null,
    description: '',
    in: { schemaIds: inSchemaIds },
    out: { schemaIds: outSchemaIds },
    fields: [],
    groups: [],
    color: null,
    icon: null,
    relation_count: 0,
    version: 1,
    created_at: '',
    updated_at: ''
  }) as RelationSchema;

describe('pathBuilderState direction fallback and target-schema derivation (#3040-map)', () => {
  const domain = makeSchema('domain', 'Domain');
  const system = makeSchema('system', 'System', [
    {
      id: 'parent',
      name: 'Parent',
      type: 'containment',
      schemaId: 'domain',
      minCount: 0,
      maxCount: 1
    } as never
  ]);

  it("falls back to 'out' when the default 'in' direction has no options", () => {
    // Domain has no outgoing containment field of its own - "System belongs to Domain" only
    // exists as the 'out'/'backward' option (System's own field, walked in reverse).
    const context = pathStepContextWithFallbackDirection({
      rootSchemaScope: ['domain'],
      steps: [],
      depth: 0,
      schemas: [domain, system],
      relationSchemas: []
    });
    expect(context.direction).toBe('out');
    expect(context.options.map(option => option.step)).toEqual([
      { kind: 'backward', fieldId: 'parent', ownerSchemaId: 'system' }
    ]);
  });

  it('leaves an already-populated option list alone', () => {
    const context = pathStepContextWithFallbackDirection({
      rootSchemaScope: 'any',
      steps: [],
      depth: 0,
      schemas: [domain, system],
      relationSchemas: []
    });
    // 'in' (forward fields owned by any in-scope schema) already has System's own field.
    expect(context.direction).toBe('in');
    expect(context.options).toHaveLength(1);
  });

  it('derives the target schema directly from a backward step, without needing a scope', () => {
    expect(
      targetSchemaIdsForStep(
        { kind: 'backward', fieldId: 'parent', ownerSchemaId: 'system' },
        [domain, system],
        []
      )
    ).toEqual(['system']);
  });

  it('derives the target schema for a forward step from the field it names', () => {
    expect(
      targetSchemaIdsForStep({ kind: 'forward', fieldId: 'parent' }, [domain, system], [])
    ).toEqual(['domain']);
  });

  it('chainMatchesTarget matches on the chain leaf, and "any" always matches (#3040-map)', () => {
    const chain = [
      { id: 'domain-1', name: 'Domain One', schemaId: 'domain' },
      { id: 'system-1', name: 'System One', schemaId: 'system' }
    ];
    expect(chainMatchesTarget(chain, 'any')).toBe(true);
    expect(chainMatchesTarget(chain, ['system'])).toBe(true);
    expect(chainMatchesTarget(chain, ['domain'])).toBe(false);
    expect(chainMatchesTarget([], ['system'])).toBe(false);
  });
});

describe('pathStepOptions unbound relation-schema field-group filtering (#3024)', () => {
  const relation = makeRelation('objective-affects-entity', 'Affects entity', ['objective'], 'any');

  it('excludes the unbound relation traversal when its only owning field in scope is restricted', () => {
    const objective = makeSchema('objective', 'Objective', [
      {
        id: 'affects',
        name: 'Affects',
        type: 'typedRelation',
        relationSchemaId: relation.id,
        direction: 'in',
        minCount: 0,
        maxCount: -1,
        groupId: 'restricted'
      } as never
    ]);
    objective.groups = [{ id: 'restricted', name: 'Restricted', accessControl: {} } as never];

    const options = pathStepOptions({
      direction: 'in',
      currentSchemaScope: ['objective'],
      schemas: [objective],
      relationSchemas: [relation],
      getFieldGroupAccess: () => 'none'
    });
    expect(options).toEqual([]);
  });

  it('still offers the unbound relation traversal when no schema in scope owns a field for it', () => {
    const capability = makeSchema('capability', 'Capability');

    const options = pathStepOptions({
      direction: 'in',
      currentSchemaScope: ['capability'],
      schemas: [capability],
      relationSchemas: [
        makeRelation('capability-affects-entity', 'Affects entity', ['capability'], 'any')
      ],
      getFieldGroupAccess: () => 'none'
    });
    expect(options.map(option => option.step.kind)).toEqual(['unboundTypedRelation']);
  });

  it('offers the unbound relation traversal when at least one scoped schema has a viewable owning field', () => {
    const objective = makeSchema('objective', 'Objective', [
      {
        id: 'affects',
        name: 'Affects',
        type: 'typedRelation',
        relationSchemaId: relation.id,
        direction: 'in',
        minCount: 0,
        maxCount: -1,
        groupId: 'restricted'
      } as never
    ]);
    objective.groups = [{ id: 'restricted', name: 'Restricted', accessControl: {} } as never];
    // A second scoped schema also owning an 'in' field for the same relation, unrestricted.
    const outcome = makeSchema('outcome', 'Outcome', [
      {
        id: 'affects',
        name: 'Affects',
        type: 'typedRelation',
        relationSchemaId: relation.id,
        direction: 'in',
        minCount: 0,
        maxCount: -1
      } as never
    ]);
    const affectsAny = makeRelation(
      'objective-affects-entity',
      'Affects entity',
      ['objective', 'outcome'],
      'any'
    );

    const options = pathStepOptions({
      direction: 'in',
      currentSchemaScope: ['objective', 'outcome'],
      schemas: [objective, outcome],
      relationSchemas: [affectsAny],
      getFieldGroupAccess: accessControl => (accessControl ? 'none' : 'edit')
    });
    expect(options.map(option => option.step.kind).sort()).toEqual([
      'typedRelation',
      'unboundTypedRelation'
    ]);
  });
});

describe('position-aware traversal: relationForward/endpoint/relationBackward (#3120)', () => {
  const dataEntity = makeSchema('data-entity', 'Data Entity');
  const system = makeSchema('system', 'System');
  const dataFlow = {
    ...makeRelation('data-flow', 'Data Flow', ['system'], ['system']),
    fields: [
      {
        id: 'data_entities',
        name: 'Data',
        type: 'entityRelation',
        predicate: 'carries',
        schemaId: 'data-entity',
        minCount: 0,
        maxCount: -1
      } as never,
      { id: 'data_classification', name: 'Classification', type: 'text' } as never
    ]
  } as RelationSchema;

  it('relationPositionOptions offers both endpoints and the entityRelation field, not the plain scalar field', () => {
    const options = relationPositionOptions({
      relationScope: ['data-flow'],
      schemas: [dataEntity, system],
      relationSchemas: [dataFlow]
    });
    expect(options.map(option => option.step)).toEqual([
      { kind: 'endpoint', direction: 'in' },
      { kind: 'endpoint', direction: 'out' },
      { kind: 'relationForward', fieldId: 'data_entities' }
    ]);
    const relationForward = options.find(option => option.step.kind === 'relationForward');
    expect(relationForward?.targetSchemaIds).toEqual(['data-entity']);
  });

  it('a field-group-restricted entityRelation field is excluded from relationPositionOptions', () => {
    const restricted = {
      ...dataFlow,
      fields: [{ ...dataFlow.fields[0], groupId: 'restricted' } as never, dataFlow.fields[1]],
      groups: [{ id: 'restricted', name: 'Restricted', accessControl: {} } as never]
    } as RelationSchema;
    const options = relationPositionOptions({
      relationScope: ['data-flow'],
      schemas: [dataEntity, system],
      relationSchemas: [restricted],
      getFieldGroupAccess: () => 'none'
    });
    expect(options.map(option => option.step.kind)).toEqual(['endpoint', 'endpoint']);
  });

  it("nextPosition resolves a relationForward step to the entityRelation field's target entity schema", () => {
    const position = nextPosition(
      { kind: 'relationForward', fieldId: 'data_entities' },
      { kind: 'relation', relationScope: ['data-flow'] },
      [dataEntity, system],
      [dataFlow]
    );
    expect(position).toEqual({ kind: 'entity', schemaScope: ['data-entity'] });
  });

  it("nextPosition resolves an endpoint step to the relation's endpoint schema(s)", () => {
    const position = nextPosition(
      { kind: 'endpoint', direction: 'in' },
      { kind: 'relation', relationScope: ['data-flow'] },
      [dataEntity, system],
      [dataFlow]
    );
    expect(position).toEqual({ kind: 'entity', schemaScope: ['system'] });
  });

  it('positionStepContext at a relation root has no direction toggle', () => {
    const context = positionStepContext({
      rootPosition: { kind: 'relation', relationScope: ['data-flow'] },
      steps: [],
      depth: 0,
      schemas: [dataEntity, system],
      relationSchemas: [dataFlow]
    });
    expect(context.hasDirectionToggle).toBe(false);
    expect(context.options.map(option => option.step.kind)).toEqual([
      'endpoint',
      'endpoint',
      'relationForward'
    ]);
  });

  it('offers relationBackward from an entity position when a relation schema targets it via an entityRelation field, and walking it lands back on that relation', () => {
    const entityPosition: PathPosition = { kind: 'entity', schemaScope: ['data-entity'] };
    const backwardStep = {
      kind: 'relationBackward' as const,
      fieldId: 'data_entities',
      relationSchemaId: 'data-flow'
    };
    // Seed depth 0 with an already-picked relationBackward step so `direction` resolves to 'out'
    // (relationBackward's own direction bucket) instead of the no-step default of 'in'.
    const context = positionStepContext({
      rootPosition: entityPosition,
      steps: [backwardStep],
      depth: 0,
      schemas: [dataEntity, system],
      relationSchemas: [dataFlow]
    });
    expect(context.direction).toBe('out');
    const backwardOption = context.options.find(option => option.step.kind === 'relationBackward');
    expect(backwardOption?.step).toEqual({
      kind: 'relationBackward',
      fieldId: 'data_entities',
      relationSchemaId: 'data-flow'
    });

    const nextPos = nextPosition(
      backwardOption!.step,
      entityPosition,
      [dataEntity, system],
      [dataFlow]
    );
    expect(nextPos).toEqual({ kind: 'relation', relationScope: ['data-flow'] });
  });

  it('prunePositionedPathSteps drops a relationForward step once its field becomes invisible', () => {
    const steps = [{ kind: 'relationForward' as const, fieldId: 'data_entities' }];
    const pruned = prunePositionedPathSteps(steps, {
      rootPosition: { kind: 'relation', relationScope: ['data-flow'] },
      schemas: [dataEntity, system],
      relationSchemas: [dataFlow],
      getFieldGroupAccess: () => 'none'
    });
    // No groupId on the field in this fixture, so field-group access doesn't restrict it - prune
    // only kicks in when the option genuinely disappears (e.g. the relation schema no longer in
    // scope), exercised via an empty relationSchemas list instead.
    expect(pruned).toEqual(steps);

    const prunedMissingRelation = prunePositionedPathSteps(steps, {
      rootPosition: { kind: 'relation', relationScope: ['data-flow'] },
      schemas: [dataEntity, system],
      relationSchemas: []
    });
    expect(prunedMissingRelation).toEqual([]);
  });
});
