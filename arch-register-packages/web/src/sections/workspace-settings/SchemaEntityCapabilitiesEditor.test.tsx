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
  it('renders capability metadata and schema field requirements', () => {
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
    expect(markup).toContain('API type');
    expect(markup).toContain('api_version');
    expect(markup).not.toContain('Enable integrations for entities');
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
