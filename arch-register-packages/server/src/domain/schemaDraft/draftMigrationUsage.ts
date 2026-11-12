import type { DatabaseAdapter } from '../../db/database';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import type { MigrationUsage, MigrationUsageProvider } from './draftMigrationReport';

const hasValue = (value: unknown) => value !== undefined && value !== null;

const usageFromRecords = (
  records: readonly { data: Record<string, unknown> }[],
  fieldIds: readonly string[]
): MigrationUsage => {
  const counts = new Map<string, number>();
  for (const fieldId of fieldIds) {
    const n = records.filter(r => hasValue(r.data[fieldId])).length;
    if (n > 0) counts.set(fieldId, n);
  }
  return { total: records.length, counts, usedFieldIds: new Set(counts.keys()) };
};

/** Read-only usage scan that mirrors how the live update routes decide which fields hold data. */
export const createMigrationUsageProvider = (
  db: DatabaseAdapter,
  workspace: string
): MigrationUsageProvider => {
  const documentUsage = async (
    typeId: string,
    fieldIds: readonly string[]
  ): Promise<MigrationUsage> => {
    const used = new Set<string>();
    const counts = new Map<string, number>();
    let total = 0;
    const templates = (await db.document.listDocumentTemplates(workspace, undefined, true)).filter(
      t => t.document_type_id === typeId
    );
    for (const node of await db.project.contentNodes.listAllContentNodes(workspace)) {
      const metadata = await db.document.getDocumentMetadata(workspace, node.id);
      if (metadata?.document_type_id === typeId) {
        total++;
        for (const id of fieldIds) {
          if (metadata.values[id] !== undefined) {
            used.add(id);
            counts.set(id, (counts.get(id) ?? 0) + 1);
          }
        }
      }
      for (const revision of await db.project.markdownRevisions.listMarkdownRevisions(
        workspace,
        node.id
      )) {
        if (revision.document_type_id !== typeId) continue;
        for (const id of fieldIds) if (revision.metadata[id] !== undefined) used.add(id);
      }
    }
    for (const template of templates) {
      for (const id of fieldIds) if (template.metadata_defaults[id] !== undefined) used.add(id);
    }
    return { total, counts, usedFieldIds: used };
  };

  const relationUsage = async (schemaId: string, fieldIds: readonly string[]) => {
    const rows: { data: Record<string, unknown> }[] = [];
    const limit = 500;
    for (let offset = 0; ; offset += limit) {
      const page = await db.relation.listRelations(workspace, { schemaId }, { limit, offset });
      rows.push(...page.items);
      if (page.items.length < limit) break;
    }
    return usageFromRecords(rows, fieldIds);
  };

  const cache = new Map<string, Promise<MigrationUsage>>();
  return (kind, itemId, fieldIds) => {
    const key = `${kind}:${itemId}`;
    let usage = cache.get(key);
    if (!usage) {
      usage =
        kind === 'entity_schema'
          ? listAllCatalogEntities(db, workspace, { schemaId: itemId }).then(entities =>
              usageFromRecords(entities, fieldIds)
            )
          : kind === 'relation_schema'
            ? relationUsage(itemId, fieldIds)
            : kind === 'document_type'
              ? documentUsage(itemId, fieldIds)
              : Promise.resolve({ total: 0, counts: new Map(), usedFieldIds: new Set<string>() });
      cache.set(key, usage);
    }
    return usage;
  };
};
