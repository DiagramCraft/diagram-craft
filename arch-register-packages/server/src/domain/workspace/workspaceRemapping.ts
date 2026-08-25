import { createHash } from 'node:crypto';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';

export type IdMap = ReadonlyMap<string, string>;

export type DocumentReferenceMaps = {
  entityMap: IdMap;
  documentMap: IdMap;
  entityIdentifierMap?: IdMap;
};

export type DocumentLinkReference = {
  target_type: 'entity' | 'document';
  target_id: string;
};

export type StorageScopeNode = {
  project_id: string | null | undefined;
  entity_id: string | null | undefined;
};

export function resolveMappedId(mapping: IdMap, id: string): string;
export function resolveMappedId(mapping: IdMap, id: string | null | undefined): string | null;
export function resolveMappedId(mapping: IdMap, id: string | null | undefined): string | null {
  if (id == null) return null;
  return mapping.get(id) ?? id;
}

export const resolveMappedIdOrNull = (
  mapping: IdMap,
  id: string | null | undefined
): string | null => (id == null ? null : (mapping.get(id) ?? null));

export const resolveStorageScope = (workspace: string, node: StorageScopeNode): string =>
  node.project_id ?? node.entity_id ?? workspace;

export const generateSchemaKeyPrefix = (seed: string): string => {
  const bytes = createHash('sha1').update(seed).digest();
  let prefix = '';
  for (const byte of bytes) {
    prefix += String.fromCharCode(65 + (byte % 26));
    if (prefix.length === 5) break;
  }
  return prefix;
};

export const remapGovernanceConfigTeams = (
  config: GovernanceWorkflowConfig,
  teamMap: IdMap
): GovernanceWorkflowConfig => ({
  ...config,
  ...(config.approvals && {
    approvals: {
      ...config.approvals,
      fallbackTeamIds: config.approvals.fallbackTeamIds.map(id => teamMap.get(id) ?? id)
    }
  }),
  ...(config.escalation && {
    escalation: {
      ...config.escalation,
      fallbackTeamIds: config.escalation.fallbackTeamIds.map(id => teamMap.get(id) ?? id)
    }
  })
});

const resolveDocumentReference = (
  targetType: DocumentLinkReference['target_type'],
  targetId: string,
  maps: DocumentReferenceMaps
): string | undefined => {
  if (targetType === 'entity') {
    const sourceEntityId = maps.entityIdentifierMap?.get(targetId) ?? targetId;
    return maps.entityMap.get(sourceEntityId);
  }
  return maps.documentMap.get(targetId);
};

export const remapDocumentMetadataValues = (
  fields: readonly DocumentField[],
  sourceValues: DocumentMetadata,
  maps: DocumentReferenceMaps
): DocumentMetadata => {
  const values = { ...sourceValues };
  for (const field of fields) {
    if (field.type !== 'entity_link' && field.type !== 'document_link') continue;
    const raw = values[field.id];
    if (raw === undefined) continue;
    const sourceIds = Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === 'string')
      : typeof raw === 'string'
        ? [raw]
        : [];
    const mapped = sourceIds
      .map(id =>
        resolveDocumentReference(field.type === 'entity_link' ? 'entity' : 'document', id, maps)
      )
      .filter((id): id is string => id != null);
    values[field.id] = Array.isArray(raw) ? mapped : (mapped[0] ?? null);
  }
  return values;
};

export const remapDocumentLinks = <T extends DocumentLinkReference>(
  links: readonly T[],
  maps: DocumentReferenceMaps
): T[] =>
  links.flatMap(link => {
    const targetId = resolveDocumentReference(link.target_type, link.target_id, maps);
    return targetId == null ? [] : [{ ...link, target_id: targetId }];
  });
