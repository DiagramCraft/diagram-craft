import { describe, expect, it } from 'vitest';
import { instantiateTemplateDefinitions } from '../catalog/schemaTemplates';

describe('workspace template creation', () => {
  it('generates different schema prefixes for different workspaces', () => {
    const first = instantiateTemplateDefinitions('workspace-1', 'backstage');
    const second = instantiateTemplateDefinitions('workspace-2', 'backstage');

    expect(first.schemas.map(schema => schema.key_prefix)).not.toEqual(
      second.schemas.map(schema => schema.key_prefix)
    );
    expect(new Set(first.schemas.map(schema => schema.key_prefix)).size).toBe(first.schemas.length);
    expect(new Set(second.schemas.map(schema => schema.key_prefix)).size).toBe(second.schemas.length);
  });
});
