import { describe, expect, it } from 'vitest';
import {
  getWorkspaceCapabilityDefinition,
  remapCapabilityFieldMappings,
  resolveCapabilityFieldMappings
} from './integrationCatalog';
import type { WorkspaceCapabilityBinding } from './workspaceCapabilityContract';

const definition = getWorkspaceCapabilityDefinition('api-specification')!;
const roles = definition.bindingRoles[0]!.fieldRoles;

describe('workspace capability field mappings', () => {
  it('uses catalog defaults and explicit role overrides', () => {
    const binding: WorkspaceCapabilityBinding = {
      target: { kind: 'entity_schema', id: 'schema-1' },
      fieldMappings: { api_type: 'protocol_kind' }
    };

    const result = resolveCapabilityFieldMappings(binding, roles, [
      { id: 'protocol_kind', type: 'text' },
      { id: 'api_version', type: 'text' }
    ]);

    expect(result.mappings).toEqual({ api_type: 'protocol_kind', api_version: 'api_version' });
    expect(result.issues).toEqual([]);
  });

  it('reports unknown, missing, archived, derived, incompatible, and duplicate targets', () => {
    const result = resolveCapabilityFieldMappings(
      {
        target: { kind: 'entity_schema', id: 'schema-1' },
        fieldMappings: {
          api_type: 'same',
          api_version: 'same',
          unknown_role: 'missing'
        }
      },
      roles,
      [
        { id: 'same', type: 'number' },
        { id: 'api_version', type: 'text', archived: true }
      ]
    );

    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['unknown_role', 'duplicate_target', 'incompatible_target'])
    );

    const missing = resolveCapabilityFieldMappings(
      {
        target: { kind: 'entity_schema', id: 'schema-1' },
        fieldMappings: { api_type: 'missing' }
      },
      roles,
      [{ id: 'api_version', type: 'text' }]
    );
    expect(missing.issues.some(issue => issue.code === 'missing_target')).toBe(true);

    const archived = resolveCapabilityFieldMappings(
      {
        target: { kind: 'entity_schema', id: 'schema-1' },
        fieldMappings: { api_version: 'api_version' }
      },
      roles,
      [
        { id: 'api_type', type: 'text' },
        { id: 'api_version', type: 'text', archived: true }
      ]
    );
    expect(archived.issues.some(issue => issue.code === 'archived_target')).toBe(true);

    const derived = resolveCapabilityFieldMappings(
      {
        target: { kind: 'entity_schema', id: 'schema-1' },
        fieldMappings: { api_type: 'derived_value' }
      },
      roles,
      [
        { id: 'derived_value', type: 'derived' },
        { id: 'api_version', type: 'text' }
      ]
    );
    expect(derived.issues.some(issue => issue.code === 'derived_target')).toBe(true);
  });

  it('remaps implicit defaults and explicit targets when a field is renamed', () => {
    const binding: WorkspaceCapabilityBinding = {
      target: { kind: 'entity_schema', id: 'schema-1' }
    };

    expect(
      remapCapabilityFieldMappings(binding, roles, [
        { oldFieldId: 'api_type', newFieldId: 'protocol_kind' }
      ])
    ).toEqual({
      target: { kind: 'entity_schema', id: 'schema-1' },
      fieldMappings: { api_type: 'protocol_kind' }
    });
  });
});

describe('workspace capability definitions', () => {
  it('describes API capability roles independently from entity opt-in metadata', () => {
    const definition = getWorkspaceCapabilityDefinition('api-specification');

    expect(definition).toMatchObject({
      type: 'api-specification',
      bindingRoles: [
        {
          id: 'api',
          required: true,
          targetKind: 'entity_schema',
          fieldRoles: expect.arrayContaining([
            expect.objectContaining({ id: 'api_type' }),
            expect.objectContaining({ id: 'api_version' })
          ])
        }
      ]
    });
  });
});
