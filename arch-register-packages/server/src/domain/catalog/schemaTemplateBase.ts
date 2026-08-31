import { AR_COLOR_PURPLE } from '@arch-register/api-types/colors';
import type { SymbolicDocumentTemplate, SymbolicDocumentType, SymbolicEnum } from './schemaTemplates';

/**
 * Small, dependency-free building blocks shared by every schema template pack (the built-in
 * "default" catalog plus each cross-cutting concern, including apps under `../../app/<name>/`).
 * Kept separate from `schemaTemplates.ts` so app packs can import these values without creating a
 * circular import back into the file that assembles `SCHEMA_TEMPLATES` from all the packs.
 */

export const enumDefinition = (
  id: string,
  name: string,
  options: SymbolicEnum['options'],
  category: string,
  sharedId?: string
): SymbolicEnum => ({ id, name, category, options, ...(sharedId ? { sharedId } : {}) });

export const ADR_DOCUMENT_TYPE_NAME = 'Architecture Decision Record';
export const ADR_DOCUMENT_TEMPLATE_NAME = 'Architecture Decision Record';

export const ADR_DOCUMENT_TYPE_DEFINITION: SymbolicDocumentType = {
  id: 'architecture-decision-record',
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
      inverseName: 'Superseded by',
      retired: false
    }
  ]
};

export const ADR_DOCUMENT_TEMPLATE_DEFINITION: SymbolicDocumentTemplate = {
  id: 'architecture-decision-record-template',
  name: ADR_DOCUMENT_TEMPLATE_NAME,
  body: '# {{title}}\n\n## Context\n\n## Decision drivers\n\n## Considered options\n\n## Decision\n\n## Consequences\n',
  documentTypeId: ADR_DOCUMENT_TYPE_DEFINITION.id,
  metadataDefaults: { status: 'Proposed' }
};

export const commonDocumentTypes = [ADR_DOCUMENT_TYPE_DEFINITION];
export const commonDocumentTemplates = [ADR_DOCUMENT_TEMPLATE_DEFINITION];
