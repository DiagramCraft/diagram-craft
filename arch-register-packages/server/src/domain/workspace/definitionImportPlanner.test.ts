import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  DefinitionImportDependencyMapping,
  DefinitionImportSelection
} from '@arch-register/api-types/workspaceContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import {
  buildDefinitionImportPlan,
  definitionImportFingerprint,
  definitionImportPlanToPreview
} from './definitionImportPlanner';
import type {
  DefinitionImportTargetState,
  DefinitionSource,
  ImportableEnum,
  ImportableRelationSchema,
  ImportableSchema
} from './definitionImportTypes';

const selection = (overrides: Partial<DefinitionImportSelection> = {}): DefinitionImportSelection => ({
  schemas: [],
  enums: [],
  documentTypes: [],
  relationSchemas: [],
  fieldGroups: [],
  dashboard: false,
  ...overrides
});

const schema = (id: string, overrides: Partial<ImportableSchema> = {}): ImportableSchema => ({
  id,
  name: id,
  category: null,
  description: '',
  key_prefix: id.slice(0, 5).toUpperCase(),
  fields: [],
  groups: [],
  shared_field_group_links: [],
  shared_field_groups: [],
  color: null,
  icon: null,
  default_owner_name: null,
  entity_approval_policy: 'disabled',
  deprecation_policy: 'disabled',
  ...overrides
});

const enumeration = (id: string): ImportableEnum => ({
  id,
  name: id,
  options: [{ value: 'one', label: 'One' }],
  sort_order: 0
});

const relationSchema = (
  id: string,
  overrides: Partial<ImportableRelationSchema> = {}
): ImportableRelationSchema => ({
  id,
  name: id,
  category: null,
  description: '',
  in_schema_ids: 'any',
  out_schema_ids: 'any',
  fields: [],
  groups: [],
  shared_field_group_links: [],
  shared_field_groups: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  ...overrides
});

const source = (overrides: Partial<DefinitionSource> = {}): DefinitionSource => ({
  kind: 'builtin',
  id: 'template',
  name: 'Template',
  description: '',
  category: 'full',
  schemas: [],
  enums: [],
  documentTypes: [],
  relationSchemas: [],
  fieldGroups: [],
  capabilityConfigurations: [],
  dashboardWidgets: [],
  dependencies: [],
  schemaPatches: [],
  teamNames: {},
  ...overrides
});

const target = (overrides: Partial<DefinitionImportTargetState> = {}): DefinitionImportTargetState => ({
  schemas: [],
  enums: [],
  documentTypes: [],
  relationSchemas: [],
  fieldGroups: [],
  isSchemaKeyPrefixUsed: async () => false,
  ...overrides
});

describe('buildDefinitionImportPlan', () => {
  it('recursively includes schema, relation-schema, and enum dependencies', async () => {
    const root: SchemaField[] = [
      { id: 'ref', name: 'Reference', type: 'reference', schemaId: 'child', minCount: 0, maxCount: 1 },
      { id: 'kind', name: 'Kind', type: 'select', enumId: 'root-enum' },
      { id: 'relation', name: 'Relation', type: 'typedRelation', relationSchemaId: 'link', direction: 'out', minCount: 0, maxCount: 1 }
    ];
    const plan = await buildDefinitionImportPlan({
      sourceData: source({
        schemas: [schema('root', { fields: root }), schema('child')],
        enums: [enumeration('root-enum'), enumeration('link-enum')],
        relationSchemas: [relationSchema('link', {
          in_schema_ids: ['root'],
          out_schema_ids: ['child'],
          fields: [{ id: 'kind', name: 'Kind', type: 'select', enumId: 'link-enum' }]
        })]
      }),
      target: target(),
      source: { kind: 'builtin', id: 'template' },
      selection: selection({ schemas: ['root'] }),
      renames: [],
      dependencyMappings: []
    });

    expect(plan.errors).toEqual([]);
    expect(plan.schemas.map(item => item.id)).toEqual(['root', 'child']);
    expect(plan.relationSchemas.map(item => item.id)).toEqual(['link']);
    expect(plan.enums.map(item => item.id)).toEqual(['root-enum', 'link-enum']);
    expect(definitionImportPlanToPreview(plan).schemas.find(item => item.id === 'child')?.dependency).toBe(true);
  });

  it('applies renames before detecting case-insensitive conflicts', async () => {
    const input = {
      sourceData: source({ schemas: [schema('schema-1', { name: 'Imported Schema' })] }),
      target: target({ schemas: [schema('existing', { name: 'Imported Schema' })] }),
      source: { kind: 'builtin' as const, id: 'template' },
      selection: selection({ schemas: ['schema-1'] }),
      renames: [{ kind: 'schema' as const, id: 'schema-1', name: 'Renamed Schema' }],
      dependencyMappings: [] as DefinitionImportDependencyMapping[]
    };
    const plan = await buildDefinitionImportPlan(input);

    expect(plan.errors).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.schemas[0]?.name).toBe('Renamed Schema');
  });

  it('reports conflicts for existing and duplicate imported names', async () => {
    const plan = await buildDefinitionImportPlan({
      sourceData: source({ schemas: [schema('one', { name: 'Duplicate' }), schema('two', { name: 'duplicate' })] }),
      target: target({ schemas: [schema('existing', { name: 'DUPLICATE' })] }),
      source: { kind: 'builtin', id: 'template' },
      selection: selection({ schemas: ['one', 'two'] }),
      renames: [],
      dependencyMappings: []
    });

    expect(plan.conflicts).toEqual([
      { kind: 'schema', id: 'one', name: 'Duplicate', existingName: 'DUPLICATE' },
      { kind: 'schema', id: 'two', name: 'duplicate', existingName: 'duplicate' },
      { kind: 'schema', id: 'two', name: 'duplicate', existingName: 'DUPLICATE' }
    ]);
  });

  it('creates deterministic key-prefix remaps and reserves each generated prefix', async () => {
    const isPrefixUsed = async (prefix: string) => prefix === 'ABCDE';
    const input = {
      sourceData: source({ schemas: [schema('schema-1', { key_prefix: 'ABCDE' })] }),
      target: target({ isSchemaKeyPrefixUsed: isPrefixUsed }),
      source: { kind: 'builtin' as const, id: 'template' },
      selection: selection({ schemas: ['schema-1'] }),
      renames: [],
      dependencyMappings: [] as DefinitionImportDependencyMapping[]
    };
    const first = await buildDefinitionImportPlan(input);
    const second = await buildDefinitionImportPlan(input);
    const expected = createHash('sha1').update('builtin:template:schema-1:0').digest('hex').slice(0, 5).toUpperCase();

    expect(first.keyPrefixRemaps).toEqual([{ sourceId: 'schema-1', name: 'schema-1', from: 'ABCDE', to: expected }]);
    expect(first.schemas[0]?.key_prefix).toBe(expected);
    expect(second.keyPrefixRemaps).toEqual(first.keyPrefixRemaps);
  });

  it('resolves mapped extension schema patches against destination schemas', async () => {
    const existing = schema('destination-schema', { name: 'Destination' });
    const plan = await buildDefinitionImportPlan({
      sourceData: source({
        relationSchemas: [relationSchema('extension-relation')],
        dependencies: [{
          id: 'template:extension:target',
          owner_id: 'template:extension',
          name: 'Destination schema',
          description: '',
          target_kind: 'schema',
          min_targets: 1,
          required_template_ids: [],
          required_template_categories: [],
          required_by: [{ kind: 'relationSchema', id: 'extension-relation', name: 'Extension relation', template_id: 'template', symbolic_id: 'extension-relation' }]
        }],
        schemaPatches: [{
          ownerId: 'template:extension',
          target: '__template_dependency__:template:extension:target',
          fields: [{ id: 'added', name: 'Added', type: 'text' }]
        }]
      }),
      target: target({ schemas: [existing] }),
      source: { kind: 'builtin', id: 'template' },
      selection: selection({ relationSchemas: ['extension-relation'] }),
      renames: [],
      dependencyMappings: [{ dependencyId: 'template:extension:target', targetIds: ['destination-schema'] }]
    });

    expect(plan.errors).toEqual([]);
    expect(plan.schemaPatches).toEqual([{ targetSchemaId: 'destination-schema', targetSchemaName: 'Destination', fields: [{ id: 'added', name: 'Added', type: 'text' }] }]);
  });

  it('fingerprints the complete deterministic planning result', async () => {
    const value = { source: 'template', remaps: [{ from: 'A', to: 'B' }] };
    expect(definitionImportFingerprint(value)).toBe(definitionImportFingerprint({ remaps: [{ to: 'B', from: 'A' }], source: 'template' }));
    expect(definitionImportFingerprint(value)).not.toBe(definitionImportFingerprint({ ...value, source: 'changed' }));
  });
});
