import { randomUUID } from 'node:crypto';
import type { DocumentTemplateDbCreate, DocumentTypeDbCreate } from './db/documentDatabase';
import { AR_COLOR_PURPLE } from '@arch-register/api-types/colors';

export const ADR_DOCUMENT_TYPE_NAME = 'Architecture Decision Record';
export const ADR_DOCUMENT_TEMPLATE_NAME = 'Architecture Decision Record';

export const buildDefaultAdrDocuments = (workspace: string, now: Date) => {
  const documentTypeId = randomUUID();
  const documentType: DocumentTypeDbCreate = {
    id: documentTypeId,
    workspace,
    name: ADR_DOCUMENT_TYPE_NAME,
    description: 'A structured record of an architecture decision.',
    color: AR_COLOR_PURPLE,
    icon: 'clipboard',
    fields: [
      {
        id: 'status',
        name: 'Status',
        type: 'enum',
        requirement: 'required',
        enumOptions: [
          { value: 'Proposed', label: 'Proposed' },
          { value: 'Accepted', label: 'Accepted' },
          { value: 'Superseded', label: 'Superseded' },
          { value: 'Deprecated', label: 'Deprecated' }
        ],
        retired: false
      },
      {
        id: 'decision_date',
        name: 'Decision date',
        type: 'date',
        requirement: 'expected',
        retired: false
      },
      {
        id: 'affected_entities',
        name: 'Affected entities',
        type: 'entity_link',
        requirement: 'optional',
        minCardinality: 0,
        retired: false
      },
      {
        id: 'supersedes',
        name: 'Supersedes',
        type: 'document_link',
        requirement: 'optional',
        minCardinality: 0,
        retired: false
      }
    ],
    created_at: now,
    updated_at: now
  };
  const template: DocumentTemplateDbCreate = {
    id: randomUUID(),
    workspace,
    project_id: null,
    name: ADR_DOCUMENT_TEMPLATE_NAME,
    body: '# {{title}}\n\n## Context\n\n## Decision drivers\n\n## Considered options\n\n## Decision\n\n## Consequences\n',
    document_type_id: documentTypeId,
    metadata_defaults: { status: 'Proposed' },
    created_at: now,
    updated_at: now
  };
  return { documentType, template };
};
