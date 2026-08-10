import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { artifactCapabilityDefinitions } from '@arch-register/api-types/artifactContract';
import type { ArtifactCapability, SchemaField } from '@arch-register/api-types/schemaContract';
import {
  getAvailableArtifactCapabilityDefinitions,
  SchemaArtifactCapabilitiesEditor
} from './SchemaArtifactCapabilitiesEditor';

const fields = [
  { id: 'api_type', name: 'API type', type: 'text' },
  { id: 'api_version', name: 'API version', type: 'text' }
] as SchemaField[];

const capability: ArtifactCapability = {
  type: 'api-specification'
};

describe('SchemaArtifactCapabilitiesEditor', () => {
  it('renders capability metadata and schema field requirements', () => {
    const markup = renderToStaticMarkup(
      <SchemaArtifactCapabilitiesEditor
        capabilities={[capability]}
        fields={fields}
        canEdit
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(markup).toContain('Artifact integrations');
    expect(markup).toContain('API specification');
    expect(markup).toContain('operations');
    expect(markup).toContain('API type');
    expect(markup).toContain('api_version');
    expect(markup).not.toContain('Enable integrations for entities');
  });

  it('offers only integration-owned profiles when adding a capability', () => {
    const markup = renderToStaticMarkup(
      <SchemaArtifactCapabilitiesEditor
        capabilities={[]}
        fields={fields}
        canEdit
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(markup).toContain('Add integration...');
    expect(markup).not.toContain('Features');
    expect(getAvailableArtifactCapabilityDefinitions([])).toEqual(artifactCapabilityDefinitions);
    expect(getAvailableArtifactCapabilityDefinitions([capability])).toEqual([]);
  });
});
