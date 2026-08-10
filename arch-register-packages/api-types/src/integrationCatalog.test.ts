import { describe, expect, it } from 'vitest';
import type { EntityCapability } from './entityCapabilityContract';
import {
  getEntityCapabilityDefinition,
  remapEntityCapabilityFieldMappings,
  resolveEntityCapabilityFieldMappings
} from './integrationCatalog';

const definition = getEntityCapabilityDefinition('api-specification')!;

describe('entity capability field mappings', () => {
  it('uses catalog defaults and explicit role overrides', () => {
    const capability: EntityCapability = {
      type: 'api-specification',
      fieldMappings: { api_type: 'protocol_kind' }
    };

    const result = resolveEntityCapabilityFieldMappings(capability, definition, [
      { id: 'protocol_kind', type: 'text' },
      { id: 'api_version', type: 'text' }
    ]);

    expect(result.mappings).toEqual({ api_type: 'protocol_kind', api_version: 'api_version' });
    expect(result.issues).toEqual([]);
  });

  it('reports unknown, missing, archived, derived, incompatible, and duplicate targets', () => {
    const result = resolveEntityCapabilityFieldMappings(
      {
        type: 'api-specification',
        fieldMappings: {
          api_type: 'same',
          api_version: 'same',
          unknown_role: 'missing'
        }
      },
      definition,
      [
        { id: 'same', type: 'number' },
        { id: 'api_version', type: 'text', archived: true }
      ]
    );

    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['unknown_role', 'duplicate_target', 'incompatible_target'])
    );

    const missing = resolveEntityCapabilityFieldMappings(
      { type: 'api-specification', fieldMappings: { api_type: 'missing' } },
      definition,
      [{ id: 'api_version', type: 'text' }]
    );
    expect(missing.issues.some(issue => issue.code === 'missing_target')).toBe(true);

    const archived = resolveEntityCapabilityFieldMappings(
      { type: 'api-specification', fieldMappings: { api_version: 'api_version' } },
      definition,
      [
        { id: 'api_type', type: 'text' },
        { id: 'api_version', type: 'text', archived: true }
      ]
    );
    expect(archived.issues.some(issue => issue.code === 'archived_target')).toBe(true);

    const derived = resolveEntityCapabilityFieldMappings(
      { type: 'api-specification', fieldMappings: { api_type: 'derived_value' } },
      definition,
      [
        { id: 'derived_value', type: 'derived' },
        { id: 'api_version', type: 'text' }
      ]
    );
    expect(derived.issues.some(issue => issue.code === 'derived_target')).toBe(true);
  });

  it('remaps implicit defaults and explicit targets when a field is renamed', () => {
    const capabilities: EntityCapability[] = [{ type: 'api-specification' }];

    expect(
      remapEntityCapabilityFieldMappings(capabilities, [
        { oldFieldId: 'api_type', newFieldId: 'protocol_kind' }
      ])
    ).toEqual([
      {
        type: 'api-specification',
        fieldMappings: { api_type: 'protocol_kind' }
      }
    ]);
  });
});
