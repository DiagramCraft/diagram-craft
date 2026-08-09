import { describe, expect, it } from 'vitest';
import { parseExportManifest, parseExportPackage } from './exportSchemas';

const manifest = {
  version: '1.0',
  format: 'zip-multi-file',
  exported_at: '2030-01-01T00:00:00.000Z',
  exported_by: 'user@example.com',
  source_workspace: { id: 'workspace-1', name: 'Workspace', url_slug: 'workspace' },
  export_options: ['schemas'],
  files: { schemas: 'schemas.json' },
  statistics: {
    entity_count: 0,
    project_count: 0,
    schema_count: 1,
    content_node_count: 0,
    total_content_size_bytes: 0
  },
  checksums: {}
};

describe('workspace export schemas', () => {
  it('parses a valid manifest and package', () => {
    expect(parseExportManifest(manifest)).toMatchObject({ version: '1.0' });
    expect(
      parseExportPackage({
        schemas: [
          {
            id: 'schema-1',
            name: 'Application',
            fields: [],
            color: null,
            icon: null,
            default_owner: null,
            key_prefix: 'APP'
          }
        ]
      }).schemas
    ).toHaveLength(1);
  });

  it('rejects malformed manifest and nested package data', () => {
    expect(() => parseExportManifest({ ...manifest, format: 'json' })).toThrow();
    expect(() =>
      parseExportPackage({
        schemas: [{ id: 'schema-1', name: 'Application', fields: 'not-an-array' }]
      })
    ).toThrow();
  });
});
