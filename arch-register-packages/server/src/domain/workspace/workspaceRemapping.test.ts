import { describe, expect, it } from 'vitest';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import {
  generateSchemaKeyPrefix,
  remapDocumentLinks,
  remapDocumentMetadataValues,
  remapGovernanceConfigTeams,
  resolveMappedId,
  resolveMappedIdOrNull,
  resolveStorageScope
} from './workspaceRemapping';

const fields: DocumentField[] = [
  {
    id: 'entity',
    name: 'Entity',
    type: 'entity_link',
    requirement: 'optional',
    maxCardinality: 1,
    retired: false
  },
  {
    id: 'documents',
    name: 'Documents',
    type: 'document_link',
    requirement: 'optional',
    maxCardinality: 3,
    retired: false
  },
  {
    id: 'title',
    name: 'Title',
    type: 'text',
    requirement: 'optional',
    retired: false
  }
];

const maps = {
  entityMap: new Map([
    ['source-entity', 'target-entity'],
    ['source-other-entity', 'target-other-entity']
  ]),
  documentMap: new Map([
    ['source-document', 'target-document'],
    ['source-other-document', 'target-other-document']
  ]),
  entityIdentifierMap: new Map([['SOURCE-1', 'source-entity']])
};

describe('workspace remapping utilities', () => {
  it('resolves mapped, missing, and nullable IDs with explicit fallback semantics', () => {
    const mapping = new Map([['source', 'target']]);

    expect(resolveMappedId(mapping, 'source')).toBe('target');
    expect(resolveMappedId(mapping, 'missing')).toBe('missing');
    expect(resolveMappedId(mapping, null)).toBeNull();
    expect(resolveMappedId(mapping, undefined)).toBeNull();
    expect(resolveMappedIdOrNull(mapping, 'missing')).toBeNull();
    expect(resolveMappedIdOrNull(mapping, null)).toBeNull();
  });

  it('uses project, entity, then workspace storage scope precedence', () => {
    expect(resolveStorageScope('workspace', { project_id: 'project', entity_id: 'entity' })).toBe(
      'project'
    );
    expect(resolveStorageScope('workspace', { project_id: null, entity_id: 'entity' })).toBe(
      'entity'
    );
    expect(resolveStorageScope('workspace', { project_id: null, entity_id: null })).toBe(
      'workspace'
    );
  });

  it('generates deterministic five-letter schema prefixes', () => {
    const first = generateSchemaKeyPrefix('workspace:schema');

    expect(first).toBe(generateSchemaKeyPrefix('workspace:schema'));
    expect(first).toMatch(/^[A-Z]{5}$/);
    expect(first).not.toBe(generateSchemaKeyPrefix('other-workspace:schema'));
  });

  it('remaps scalar and multi-value document links while dropping missing targets', () => {
    const sourceValues: DocumentMetadata = {
      entity: 'SOURCE-1',
      documents: ['source-document', 'missing-document', 'source-other-document'],
      title: 'unchanged'
    };

    expect(remapDocumentMetadataValues(fields, sourceValues, maps)).toEqual({
      entity: 'target-entity',
      documents: ['target-document', 'target-other-document'],
      title: 'unchanged'
    });
    expect(remapDocumentMetadataValues(fields, { entity: 'missing-entity' }, maps)).toEqual({
      entity: null
    });
  });

  it('remaps indexed document links using the same entity aliases and target maps', () => {
    const links = [
      { field_id: 'entity', target_type: 'entity' as const, target_id: 'SOURCE-1', position: 0 },
      {
        field_id: 'documents',
        target_type: 'document' as const,
        target_id: 'source-document',
        position: 0
      },
      {
        field_id: 'documents',
        target_type: 'document' as const,
        target_id: 'missing-document',
        position: 1
      }
    ];

    expect(remapDocumentLinks(links, maps)).toEqual([
      { field_id: 'entity', target_type: 'entity', target_id: 'target-entity', position: 0 },
      {
        field_id: 'documents',
        target_type: 'document',
        target_id: 'target-document',
        position: 0
      }
    ]);
  });

  it('remaps approval and escalation fallback teams without changing other config', () => {
    const config: GovernanceWorkflowConfig = {
      approvals: {
        requiredApprovals: 2,
        strategyConfig: {},
        fallbackTeamIds: ['source-team', 'missing-team'],
        fallbackUserIds: ['user-1']
      },
      escalation: {
        enabled: true,
        overdueDays: 2,
        strategyConfig: {},
        fallbackTeamIds: ['source-team'],
        fallbackUserIds: []
      },
      extensions: { custom: { enabled: true } }
    };

    expect(remapGovernanceConfigTeams(config, new Map([['source-team', 'target-team']]))).toEqual({
      ...config,
      approvals: {
        ...config.approvals,
        fallbackTeamIds: ['target-team', 'missing-team']
      },
      escalation: {
        ...config.escalation,
        fallbackTeamIds: ['target-team']
      }
    });
    expect(config.approvals?.fallbackTeamIds).toEqual(['source-team', 'missing-team']);
  });
});
