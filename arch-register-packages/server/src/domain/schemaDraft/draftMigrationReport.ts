import type { FieldMigrations } from '@arch-register/api-types/common';
import {
  describeHardBlockedChange,
  planFieldMigrations,
  type FieldChangeKind
} from '../fieldMigration/fieldMigrationPlanning';
import { toFieldMigrationFields } from '../catalog/schemaHelpers';
import { toFieldMigrationFields as toDocumentFields } from '../document/documentSchemaHelpers';
import type { DraftCatalog } from './draftCatalog';
import type { SchemaDraftKind } from './db/schemaDraftDatabase';

export type MigrationReportChange = {
  fieldId: string;
  fieldName: string;
  kind: FieldChangeKind;
  renamedToId?: string;
  /** Number of records with a value in the (old) field. */
  recordCount: number;
  /** The decision supplied in the draft payload, when one exists. */
  decision?: 'rename' | 'remove' | 'archive';
};

export type MigrationReportItem = {
  kind: SchemaDraftKind;
  itemId: string;
  name: string;
  /** Total records of this item (entities, relations, documents) before any decision applies. */
  recordCount: number;
  /** Changes that can never be applied while records exist. */
  hardBlocks: (MigrationReportChange & { message: string })[];
  /** Changes that need a decision and have none yet. */
  unresolved: MigrationReportChange[];
  /** Changes that have a decision. */
  resolved: MigrationReportChange[];
};

/** How much data an item has, so the planner can ignore changes on unused fields. */
export type MigrationUsage = {
  /** Total records of the item (entities, relations, documents). */
  total: number;
  /** Records with a value, per field id. */
  counts: ReadonlyMap<string, number>;
  /** Fields with any data anywhere (documents also count revisions and templates). */
  usedFieldIds: ReadonlySet<string>;
};

export type MigrationUsageProvider = (
  kind: SchemaDraftKind,
  itemId: string,
  fieldIds: readonly string[]
) => Promise<MigrationUsage>;

type Candidate = {
  kind: SchemaDraftKind;
  itemId: string;
  name: string;
  oldFields: ReturnType<typeof toFieldMigrationFields>;
  newFields: ReturnType<typeof toFieldMigrationFields>;
  fieldMigrations: FieldMigrations | undefined;
};

const sameFields = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Plans field migrations for every entity schema, relation schema and document type whose fields
 * change (including through a shared field group), mirroring the checks the live update routes
 * make, without executing anything.
 */
export const buildMigrationReport = async (
  catalog: DraftCatalog,
  payloads: ReadonlyMap<string, { fieldMigrations?: FieldMigrations }>,
  usageOf: MigrationUsageProvider
): Promise<MigrationReportItem[]> => {
  const candidates: Candidate[] = [];
  const decisionsFor = (kind: SchemaDraftKind, id: string, groupIds: readonly string[]) => {
    const merged: FieldMigrations = {};
    for (const groupId of groupIds) {
      Object.assign(merged, payloads.get(`field_group:${groupId}`)?.fieldMigrations);
    }
    Object.assign(merged, payloads.get(`${kind}:${id}`)?.fieldMigrations);
    return Object.keys(merged).length > 0 ? merged : undefined;
  };

  for (const oldRow of catalog.live.schemas) {
    const newRow = catalog.draft.schemas.find(s => s.id === oldRow.id);
    if (!newRow || sameFields(oldRow.fields, newRow.fields)) continue;
    candidates.push({
      kind: 'entity_schema',
      itemId: oldRow.id,
      name: newRow.name,
      oldFields: toFieldMigrationFields(oldRow.fields),
      newFields: toFieldMigrationFields(newRow.fields),
      fieldMigrations: decisionsFor(
        'entity_schema',
        oldRow.id,
        (oldRow.shared_field_group_links ?? []).map(l => l.groupId)
      )
    });
  }
  for (const oldRow of catalog.live.relationSchemas) {
    const newRow = catalog.draft.relationSchemas.find(s => s.id === oldRow.id);
    if (!newRow || sameFields(oldRow.fields, newRow.fields)) continue;
    candidates.push({
      kind: 'relation_schema',
      itemId: oldRow.id,
      name: newRow.name,
      oldFields: toFieldMigrationFields(oldRow.fields as never),
      newFields: toFieldMigrationFields(newRow.fields as never),
      fieldMigrations: decisionsFor(
        'relation_schema',
        oldRow.id,
        (oldRow.shared_field_group_links ?? []).map(l => l.groupId)
      )
    });
  }
  for (const oldRow of catalog.live.documentTypes) {
    const newRow = catalog.draft.documentTypes.find(s => s.id === oldRow.id);
    if (!newRow || sameFields(oldRow.fields, newRow.fields)) continue;
    candidates.push({
      kind: 'document_type',
      itemId: oldRow.id,
      name: newRow.name,
      oldFields: toDocumentFields(oldRow.fields),
      newFields: toDocumentFields(newRow.fields),
      fieldMigrations: decisionsFor('document_type', oldRow.id, [])
    });
  }

  const report: MigrationReportItem[] = [];
  for (const candidate of candidates) {
    const isDocument = candidate.kind === 'document_type';
    const usage = await usageOf(
      candidate.kind,
      candidate.itemId,
      candidate.oldFields.map(f => f.id)
    );
    // Entities and relations: any data makes every change matter. Documents: only used fields.
    const none = new Set<string>();
    const required = isDocument ? usage.usedFieldIds : usage.total > 0 ? undefined : none;
    const plan = planFieldMigrations(
      candidate.oldFields,
      candidate.newFields,
      candidate.fieldMigrations,
      { decisionRequiredFieldIds: required, applicableFieldIds: required }
    );

    const toChange = (c: (typeof plan.changes)[number]): MigrationReportChange => ({
      fieldId: c.fieldId,
      fieldName: c.fieldName,
      kind: c.kind,
      renamedToId: c.renamedToId,
      recordCount: usage.counts.get(c.fieldId) ?? 0,
      decision: candidate.fieldMigrations?.[c.fieldId]?.action
    });

    const item: MigrationReportItem = {
      kind: candidate.kind,
      itemId: candidate.itemId,
      name: candidate.name,
      recordCount: usage.total,
      hardBlocks: [],
      unresolved: [],
      resolved: []
    };
    if (isDocument || usage.total > 0) {
      const blocked = plan.hardBlocked.filter(
        c => !isDocument || (c.kind === 'type-changed' && usage.usedFieldIds.has(c.fieldId))
      );
      for (const c of blocked) {
        item.hardBlocks.push({
          ...toChange(c),
          message: describeHardBlockedChange(c, isDocument ? 'document data' : 'entities')
        });
      }
      const unresolvedIds = new Set(plan.unresolved.map(c => c.fieldId));
      for (const c of plan.changes) {
        if (plan.hardBlocked.some(h => h.fieldId === c.fieldId)) continue;
        if (unresolvedIds.has(c.fieldId)) item.unresolved.push(toChange(c));
        else if (candidate.fieldMigrations?.[c.fieldId]) item.resolved.push(toChange(c));
      }
    }
    if (item.hardBlocks.length || item.unresolved.length || item.resolved.length) {
      report.push(item);
    }
  }
  return report;
};
