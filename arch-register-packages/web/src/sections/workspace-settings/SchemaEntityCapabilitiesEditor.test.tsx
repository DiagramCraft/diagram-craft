import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { entityCapabilityDefinitions } from '@arch-register/api-types/integrationCatalog';
import type { EntityCapability } from '@arch-register/api-types/entityCapabilityContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import {
  getAvailableEntityCapabilityDefinitions,
  SchemaEntityCapabilitiesEditor
} from './SchemaEntityCapabilitiesEditor';

const fields = [
  { id: 'api_type', name: 'API type', type: 'text' },
  { id: 'api_version', name: 'API version', type: 'text' }
] as SchemaField[];

const capability: EntityCapability = {
  type: 'api-specification'
};

describe('SchemaEntityCapabilitiesEditor', () => {
  it('renders capability metadata and editable semantic field mappings', () => {
    const markup = renderToStaticMarkup(
      <SchemaEntityCapabilitiesEditor
        capabilities={[capability]}
        fields={fields}
        canEdit
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(markup).toContain('Entity capabilities');
    expect(markup).toContain('API specification');
    expect(markup).toContain('operations');
    expect(markup).toContain('Schema field mappings');
    expect(markup).toContain('API type');
    expect(markup).toContain('api_version');
    expect(markup).toContain('Default:');
    expect(markup).not.toContain('Enable integrations for entities');
  });

  it('renders custom targets and invalid mapping warnings', () => {
    const markup = renderToStaticMarkup(
      <SchemaEntityCapabilitiesEditor
        capabilities={[{
          type: 'api-specification',
          fieldMappings: { api_type: 'protocol_kind', api_version: 'archived_version' }
        }]}
        fields={[
          { id: 'protocol_kind', name: 'Protocol kind', type: 'text' },
          { id: 'archived_version', name: 'Archived version', type: 'text', archived: true }
        ] as SchemaField[]}
        canEdit
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(markup).toContain('Protocol kind');
    expect(markup).toContain('Archived version');
    expect(markup).toContain('cannot target archived field');
    expect(markup).toContain('Fix the field mapping before registering artifacts');
  });

  it('offers only integration-owned profiles when adding a capability', () => {
    const markup = renderToStaticMarkup(
      <SchemaEntityCapabilitiesEditor
        capabilities={[]}
        fields={fields}
        canEdit
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(markup).toContain('Add capability...');
    expect(markup).not.toContain('Features');
    expect(getAvailableEntityCapabilityDefinitions([])).toEqual(entityCapabilityDefinitions);
    expect(getAvailableEntityCapabilityDefinitions([capability])).toEqual([]);
  });
});
