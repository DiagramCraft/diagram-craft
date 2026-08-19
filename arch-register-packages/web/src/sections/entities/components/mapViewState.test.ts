import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';
import type { MapLevelConfig } from './mapViewState';
import {
  buildContainmentTreeIndex,
  getChildLevelOptions,
  getChildSchemas,
  getChildRelationSchemas,
  getContainmentChildren,
  getMapRoots,
  getMapTraversalPath,
  getMapSchemaIds,
  pathStepToMetricTraversalStep,
  repairMapLevelSchemaIds,
  resolveDefaultStep,
  resolveMapTraversalPath,
  sortContainmentNodes
} from './mapViewState';

const schema = (id: string, parentSchemaId?: string) =>
  ({
    id,
    name: id,
    fields: parentSchemaId
      ? [{ id: 'parent', name: 'Parent', type: 'containment', schemaId: parentSchemaId }]
      : []
  }) as unknown as EntitySchema;

const node = (id: string, schemaId: string, name: string, isMatch = true) =>
  ({
    _uid: id,
    _name: name,
    _slug: id,
    _schema: { id: schemaId, name: schemaId },
    _isMatch: isMatch
  }) as unknown as TreeNode;

describe('map view state', () => {
  it('finds schemas whose containment points to the selected parent', () => {
    expect(
      getChildSchemas(
        [schema('service'), schema('app', 'service'), schema('team', 'other')],
        'service'
      ).map(item => item.id)
    ).toEqual(['app']);
    expect(getChildSchemas([schema('service')], null).map(item => item.id)).toEqual(['service']);
  });

  it('includes typed-relation target schemas as map children', () => {
    const system = {
      ...schema('system'),
      fields: [
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    } as unknown as EntitySchema;
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;
    expect(getChildSchemas([system, contract], 'system', [relationSchema])).toEqual([contract]);
  });

  it('builds the Domain → System → Contract traversal automatically', () => {
    const domain = schema('domain');
    const system = {
      ...schema('system', 'domain'),
      fields: [
        { id: 'domain', name: 'Domain', type: 'containment', schemaId: 'domain' },
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    } as unknown as EntitySchema;
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;
    expect(
      getMapTraversalPath(
        ['domain', 'system', 'contract'],
        [domain, system, contract],
        [relationSchema]
      )
    ).toEqual([
      { kind: 'relation', fieldId: 'domain', direction: 'backward', ownerSchemaId: 'system' },
      {
        kind: 'typedRelation',
        fieldId: 'contracts',
        relationSchemaId: 'system-contract',
        direction: 'in'
      }
    ]);
  });

  it('offers System Contract as a selectable relation level', () => {
    const system = {
      ...schema('system'),
      fields: [
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    } as unknown as EntitySchema;
    const relationSchema = {
      id: 'system-contract',
      name: 'System Contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;
    expect(getChildRelationSchemas([system], 'system', [relationSchema])).toEqual([relationSchema]);
    expect(getMapTraversalPath(['system', 'system-contract'], [system], [relationSchema])).toEqual([
      {
        kind: 'typedRelation',
        fieldId: 'contracts',
        relationSchemaId: 'system-contract',
        direction: 'in'
      }
    ]);
  });

  it('keeps the typed relation hop when an endpoint is shown after the relation level', () => {
    const system = {
      ...schema('system'),
      fields: [
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    } as unknown as EntitySchema;
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;
    expect(
      getMapTraversalPath(
        ['system', 'system-contract', 'contract'],
        [system, contract],
        [relationSchema]
      )
    ).toEqual([
      {
        kind: 'typedRelation',
        fieldId: 'contracts',
        relationSchemaId: 'system-contract',
        direction: 'in'
      }
    ]);
  });

  it('requires an explicit relation level for a field-less typed relation', () => {
    const system = schema('system');
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      name: 'System Contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;

    expect(getChildSchemas([system, contract], 'system', [relationSchema])).toEqual([]);
    expect(getChildRelationSchemas([system], 'system', [relationSchema])).toEqual([relationSchema]);
    expect(
      getMapTraversalPath(
        ['system', 'system-contract', 'contract'],
        [system, contract],
        [relationSchema]
      )
    ).toEqual([
      {
        kind: 'unboundTypedRelation',
        relationSchemaId: 'system-contract',
        direction: 'in'
      }
    ]);
    expect(
      resolveMapTraversalPath(['system', 'contract'], [system, contract], [relationSchema]).error
    ).toContain('intermediate map level');
  });

  it('uses both directions for a field-less self-loop relation', () => {
    const system = schema('system');
    const relationSchema = {
      id: 'system-links',
      name: 'System Links',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['system'] }
    } as unknown as RelationSchema;
    expect(getMapTraversalPath(['system', 'system-links'], [system], [relationSchema])).toEqual([
      {
        kind: 'unboundTypedRelation',
        relationSchemaId: 'system-links',
        direction: 'both'
      }
    ]);
  });

  it('indexes edges and sorts structural children', () => {
    const nodes = [
      node('b', 'app', 'Beta'),
      node('a', 'app', 'Alpha'),
      node('hidden', 'app', 'Hidden', false),
      node('other', 'team', 'Other')
    ];
    const edges = [
      { parentId: 'root', childId: 'b' },
      { parentId: 'root', childId: 'a' },
      { parentId: 'root', childId: 'hidden' },
      { parentId: 'root', childId: 'other' }
    ] as unknown as TreeEdge[];
    const index = buildContainmentTreeIndex(nodes, edges);
    expect(sortContainmentNodes(nodes, 'app').map(item => item._uid)).toEqual(['a', 'b', 'hidden']);
    expect(getContainmentChildren('root', 'app', index).map(item => item._uid)).toEqual([
      'a',
      'b',
      'hidden'
    ]);
  });

  it('keeps only top-level recursive entities as map roots', () => {
    const nodes = [
      node('root', 'capability', 'Root'),
      node('nested', 'capability', 'Nested', false),
      node('other', 'capability', 'Other'),
      node('child', 'component', 'Child')
    ];
    const edges = [
      { parentId: 'root', childId: 'nested' },
      { parentId: 'root', childId: 'child' }
    ] as unknown as TreeEdge[];

    expect(getMapRoots(nodes, edges, 'capability').map(item => item._uid)).toEqual([
      'other',
      'root'
    ]);
  });

  it('collects the schema ids for the configured map levels', () => {
    expect(
      getMapSchemaIds({
        levels: 3,
        level1SchemaId: 'domain',
        level2SchemaId: 'system',
        level3SchemaId: 'component'
      })
    ).toEqual(['domain', 'system', 'component']);
  });

  it('collects schema ids from an arbitrary ordered level list', () => {
    expect(
      getMapSchemaIds({
        levelConfigs: [
          { schemaId: 'domain', columns: 3 },
          { schemaId: 'system', columns: 2, hidden: true },
          { schemaId: 'component', columns: 2 },
          { schemaId: 'resource', columns: 1 }
        ]
      })
    ).toEqual(['domain', 'system', 'component', 'resource']);
  });

  it('offers relation endpoints after a typed relation level', () => {
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      name: 'System Contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;
    expect(getChildLevelOptions([contract], 'system-contract', [relationSchema])).toEqual([
      contract
    ]);
  });

  it('truncates to the number of active levels', () => {
    expect(
      getMapSchemaIds({
        levels: 1,
        level1SchemaId: 'domain',
        level2SchemaId: 'system',
        level3SchemaId: 'component'
      })
    ).toEqual(['domain']);
  });

  it('filters out unset levels and dedupes repeated schema ids', () => {
    expect(
      getMapSchemaIds({
        levels: 3,
        level1SchemaId: 'domain',
        level2SchemaId: null,
        level3SchemaId: 'domain'
      })
    ).toEqual(['domain']);
  });

  it('returns an empty list when the map is unconfigured', () => {
    expect(
      getMapSchemaIds({
        levels: 2,
        level1SchemaId: null,
        level2SchemaId: null,
        level3SchemaId: null
      })
    ).toEqual([]);
  });

  it('resolveDefaultStep matches a plain containment/typed-relation hop as a PathStep (#3040-map)', () => {
    const domain = schema('domain');
    const system = {
      ...schema('system', 'domain'),
      fields: [
        { id: 'domain', name: 'Domain', type: 'containment', schemaId: 'domain' },
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    } as unknown as EntitySchema;
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;

    expect(resolveDefaultStep(domain, system, [relationSchema], () => 'edit')).toEqual({
      kind: 'backward',
      fieldId: 'domain',
      ownerSchemaId: 'system'
    });
    expect(resolveDefaultStep(system, contract, [relationSchema], () => 'edit')).toEqual({
      kind: 'typedRelation',
      fieldId: 'contracts',
      relationSchemaId: 'system-contract',
      direction: 'in',
      ownerSchemaIds: ['system']
    });
  });

  it('pathStepToMetricTraversalStep narrows every hop kind the map hop editor can produce (#3040-map)', () => {
    expect(pathStepToMetricTraversalStep({ kind: 'forward', fieldId: 'f' })).toEqual({
      kind: 'relation',
      fieldId: 'f',
      direction: 'forward'
    });
    expect(
      pathStepToMetricTraversalStep({ kind: 'backward', fieldId: 'f', ownerSchemaId: 'owner' })
    ).toEqual({ kind: 'relation', fieldId: 'f', direction: 'backward', ownerSchemaId: 'owner' });
    expect(
      pathStepToMetricTraversalStep({
        kind: 'typedRelation',
        fieldId: 'f',
        relationSchemaId: 'r',
        direction: 'in',
        ownerSchemaIds: ['owner']
      })
    ).toEqual({ kind: 'typedRelation', fieldId: 'f', relationSchemaId: 'r', direction: 'in' });
    expect(
      pathStepToMetricTraversalStep({
        kind: 'unboundTypedRelation',
        relationSchemaId: 'r',
        direction: 'out'
      })
    ).toEqual({ kind: 'unboundTypedRelation', relationSchemaId: 'r', direction: 'out' });
    expect(pathStepToMetricTraversalStep({ kind: 'endpoint', direction: 'in' })).toBeNull();
  });

  it("honors an explicit level step over the auto-derived default, disambiguating two same-target typed-relation fields (#3040-map)", () => {
    const system = {
      ...schema('system'),
      fields: [
        {
          id: 'primary-contract',
          name: 'Primary contract',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'backup-contract',
          name: 'Backup contract',
          type: 'typedRelation',
          relationSchemaId: 'system-contract',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ]
    } as unknown as EntitySchema;
    const contract = schema('contract');
    const relationSchema = {
      id: 'system-contract',
      in: { schemaIds: ['system'] },
      out: { schemaIds: ['contract'] }
    } as unknown as RelationSchema;

    // Without an explicit step, resolution picks whichever typed-relation field is found first.
    expect(
      getMapTraversalPath(['system', 'contract'], [system, contract], [relationSchema])
    ).toEqual([
      { kind: 'typedRelation', fieldId: 'primary-contract', relationSchemaId: 'system-contract', direction: 'in' }
    ]);

    // An explicit step for the second field overrides that default, picking the field the user
    // actually selected in the hop editor rather than the auto-inferred first match.
    expect(
      resolveMapTraversalPath(
        ['system', 'contract'],
        [system, contract],
        [relationSchema],
        () => 'edit',
        [
          undefined,
          {
            kind: 'typedRelation',
            fieldId: 'backup-contract',
            relationSchemaId: 'system-contract',
            direction: 'in',
            ownerSchemaIds: ['system']
          }
        ]
      ).path
    ).toEqual([
      { kind: 'typedRelation', fieldId: 'backup-contract', relationSchemaId: 'system-contract', direction: 'in' }
    ]);
  });

  it('repairMapLevelSchemaIds fills in a schemaId left unresolved by a saved step (#3040-map)', () => {
    const domain = schema('domain');
    const system = schema('system', 'domain');
    const levelConfigs: MapLevelConfig[] = [
      { schemaId: 'domain', columns: 2 },
      {
        schemaId: null,
        columns: 3,
        step: { kind: 'backward', fieldId: 'parent', ownerSchemaId: 'system' }
      }
    ];

    const repaired = repairMapLevelSchemaIds(levelConfigs, [domain, system], []);
    expect(repaired).not.toBe(levelConfigs);
    expect(repaired[1]?.schemaId).toBe('system');
    expect(repaired[1]?.step).toEqual(levelConfigs[1]?.step);

    // Nothing to repair - same reference back so callers can skip a no-op config write.
    expect(repairMapLevelSchemaIds(repaired, [domain, system], [])).toBe(repaired);
  });
});
