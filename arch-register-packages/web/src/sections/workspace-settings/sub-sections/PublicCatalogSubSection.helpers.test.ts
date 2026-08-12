import { describe, expect, it } from 'vitest';
import type {
  PublicCatalogConfig,
  PublicCatalogSelectorOptions
} from '@arch-register/api-types/publicCatalogContract';
import {
  isDraftEntityPublished,
  publicPathFromNodePath,
  validatePublicCatalogDraft
} from './PublicCatalogSubSection.helpers';

const options = {
  schemas: [
    {
      id: 'schema-service',
      name: 'Service',
      description: '',
      keyPrefix: 'SVC',
      fields: [
        { id: 'name', name: 'Name', type: 'text', selectable: true },
        {
          id: 'secret',
          name: 'Secret',
          type: 'text',
          selectable: false,
          reason: 'Restricted field groups cannot be published'
        }
      ]
    }
  ],
  entities: [
    {
      id: 'entity-public',
      publicId: 'SVC-001',
      slug: 'catalog',
      name: 'Catalog',
      schemaId: 'schema-service',
      schemaName: 'Service',
      projectOnly: false,
      selectable: true
    },
    {
      id: 'entity-project',
      publicId: 'SVC-002',
      slug: 'private',
      name: 'Private',
      schemaId: 'schema-service',
      schemaName: 'Service',
      projectOnly: true,
      selectable: false,
      reason: 'Project-only entities cannot be published'
    }
  ],
  pages: [
    {
      nodeId: 'workspace-page',
      scope: 'workspace',
      entityId: null,
      entityPublicId: null,
      entityName: null,
      path: 'guide',
      name: 'Guide',
      selectable: true
    },
    {
      nodeId: 'entity-page',
      scope: 'entity',
      entityId: 'entity-public',
      entityPublicId: 'SVC-001',
      entityName: 'Catalog',
      path: 'catalog',
      name: 'Catalog guide',
      selectable: true
    }
  ],
  apiArtifacts: []
} as PublicCatalogSelectorOptions;

const baseConfig: PublicCatalogConfig = {
  enabled: false,
  indexable: false,
  schemas: [],
  entityOverrides: [],
  pages: [],
  apiArtifacts: []
};

describe('public catalog guided editor validation', () => {
  it('derives public paths without Markdown extensions', () => {
    expect(publicPathFromNodePath('/docs/getting-started.mdx')).toBe('docs/getting-started');
  });

  it('does not treat an unconfigured entity as published', () => {
    expect(isDraftEntityPublished(baseConfig, options, 'entity-public')).toBe(false);
    expect(
      isDraftEntityPublished(
        { ...baseConfig, schemas: [{ schemaId: 'schema-service', fieldIds: ['name'] }] },
        options,
        'SVC-001'
      )
    ).toBe(true);
  });

  it('reports restricted, project-only, and unpublished selections inline', () => {
    const validation = validatePublicCatalogDraft(
      {
        ...baseConfig,
        schemas: [{ schemaId: 'schema-service', fieldIds: ['secret'] }],
        entityOverrides: [{ entityId: 'entity-project', mode: 'publish' }],
        pages: []
      },
      options
    );

    expect(validation.schemaErrors[0]).toContain('Restricted field groups cannot be published');
    expect(validation.entityOverrideErrors[0]).toContain(
      'Project-only entities cannot be published'
    );
    const pageValidation = validatePublicCatalogDraft(
      {
        ...baseConfig,
        pages: [
          {
            nodeId: 'entity-page',
            scope: 'entity',
            entityId: 'entity-public',
            publicPath: 'catalog',
            order: 0
          }
        ]
      },
      options
    );
    expect(pageValidation.pageErrors[0]).toContain(
      'Publish the owning entity before publishing its wiki page.'
    );
  });
});
