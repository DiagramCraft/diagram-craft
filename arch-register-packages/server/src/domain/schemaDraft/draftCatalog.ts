import type { DatabaseAdapter } from '../../db/database';
import type {
  CategoryDbResult,
  SchemaDbResult,
  SharedFieldGroupDbResult,
  WorkspaceEnumDbResult
} from '../catalog/db/catalogDatabase';
import type { RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import type { DocumentTypeDbResult } from '../document/db/documentDatabase';
import type {
  SchemaDraftItemDbResult,
  SchemaDraftKind,
  SchemaDraftOp
} from './db/schemaDraftDatabase';
import { buildCreateSchemaInput, buildUpdateSchemaInput } from '../catalog/schemaHelpers';
import {
  buildCreateRelationSchemaInput,
  buildUpdateRelationSchemaInput,
  compileRelationSchemaWithSharedGroups
} from '../catalog/relationSchemaHelpers';
import {
  buildCreateSharedFieldGroupInput,
  buildUpdateSharedFieldGroupInput,
  compileSchemaWithSharedGroups
} from '../catalog/fieldGroupHelpers';
import { buildCreateEnumInput, buildUpdateEnumInput } from '../catalog/enumHelpers';

/**
 * A catalog snapshot: the live catalog with a schema draft applied on top. Entity and relation
 * schemas are compiled (shared field groups inlined), so validators can use them exactly like live
 * rows. Building one never writes anything.
 */
export type CatalogSnapshot = {
  schemas: SchemaDbResult[];
  relationSchemas: RelationSchemaDbResult[];
  documentTypes: DocumentTypeDbResult[];
  enums: WorkspaceEnumDbResult[];
  fieldGroups: SharedFieldGroupDbResult[];
  categories: CategoryDbResult[];
};

export type DraftCatalogIssue = {
  kind: SchemaDraftKind;
  itemId: string;
  op: SchemaDraftOp;
  message: string;
};

export type DraftCatalogItemChange = {
  kind: SchemaDraftKind;
  itemId: string;
  op: SchemaDraftOp;
  name: string | null;
  /** Live row name for update/delete, so the review can show renames. */
  liveName: string | null;
};

export type DraftCatalog = {
  live: CatalogSnapshot;
  draft: CatalogSnapshot;
  changes: DraftCatalogItemChange[];
  /** Draft items that could not be applied (invalid payload, unresolved references, ...). */
  issues: DraftCatalogIssue[];
};

type Payload = Record<string, unknown>;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const upsert = <T extends { id: string }>(rows: T[], row: T): T[] =>
  rows.some(r => r.id === row.id) ? rows.map(r => (r.id === row.id ? row : r)) : [...rows, row];

const remove = <T extends { id: string }>(rows: T[], id: string): T[] =>
  rows.filter(r => r.id !== id);

/** Pure: applies draft items over a live (uncompiled) snapshot. */
export const applyDraftItems = (
  live: CatalogSnapshot,
  items: readonly Pick<SchemaDraftItemDbResult, 'kind' | 'item_id' | 'op' | 'payload'>[],
  options: { workspace: string; teamIds: Set<string>; now: Date }
): DraftCatalog => {
  const { workspace, teamIds, now } = options;
  const issues: DraftCatalogIssue[] = [];
  const changes: DraftCatalogItemChange[] = [];
  const draft: CatalogSnapshot = {
    schemas: [...live.schemas],
    relationSchemas: [...live.relationSchemas],
    documentTypes: [...live.documentTypes],
    enums: [...live.enums],
    fieldGroups: [...live.fieldGroups],
    categories: [...live.categories]
  };

  const byKind = (kind: SchemaDraftKind) => items.filter(i => i.kind === kind);

  const apply = <T extends { id: string; name: string }>(
    kind: SchemaDraftKind,
    key: keyof CatalogSnapshot,
    build: (item: (typeof items)[number], current: T | undefined) => T
  ) => {
    for (const item of byKind(kind)) {
      const rows = draft[key] as unknown as T[];
      const current = live[key].find(r => r.id === item.item_id) as unknown as T | undefined;
      changes.push({
        kind,
        itemId: item.item_id,
        op: item.op,
        name: null,
        liveName: current?.name ?? null
      });
      const change = changes[changes.length - 1]!;
      try {
        if (item.op === 'delete') {
          (draft[key] as unknown as T[]) = remove(rows, item.item_id);
          change.name = current?.name ?? null;
          continue;
        }
        const row = build(item, current);
        change.name = row.name;
        (draft[key] as unknown as T[]) = upsert(rows, row);
      } catch (error) {
        issues.push({ kind, itemId: item.item_id, op: item.op, message: messageOf(error) });
      }
    }
  };

  const body = (item: { payload: unknown }) => (item.payload ?? {}) as Payload;

  apply<CategoryDbResult>('category', 'categories', (item, current) => ({
    id: item.item_id,
    workspace,
    name: String(body(item).name ?? '').trim(),
    created_at: current?.created_at ?? now,
    updated_at: now
  }));

  apply<WorkspaceEnumDbResult>('enum', 'enums', (item, current) => {
    if (!current) return { ...buildCreateEnumInput(workspace, body(item), now), id: item.item_id };
    return {
      ...current,
      ...buildUpdateEnumInput(body(item), current, now)
    };
  });

  apply<SharedFieldGroupDbResult>('field_group', 'fieldGroups', (item, current) => {
    if (!current) {
      return {
        ...buildCreateSharedFieldGroupInput(workspace, body(item) as never, now),
        id: item.item_id
      };
    }
    return { ...current, ...buildUpdateSharedFieldGroupInput(body(item) as never, current, now) };
  });

  // Entity schemas are applied before relation schemas so endpoints can be resolved against them.
  apply<SchemaDbResult>('entity_schema', 'schemas', (item, current) => {
    if (!current) {
      return {
        ...buildCreateSchemaInput(workspace, body(item), teamIds, now),
        id: item.item_id
      } as SchemaDbResult;
    }
    return {
      ...current,
      ...buildUpdateSchemaInput(body(item), current, teamIds, now)
    } as SchemaDbResult;
  });

  const knownEntitySchemaIds = new Set(draft.schemas.map(s => s.id));
  apply<RelationSchemaDbResult>('relation_schema', 'relationSchemas', (item, current) => {
    if (!current) {
      return {
        ...buildCreateRelationSchemaInput(workspace, body(item), knownEntitySchemaIds, now),
        id: item.item_id
      } as RelationSchemaDbResult;
    }
    return {
      ...current,
      ...buildUpdateRelationSchemaInput(body(item), current, knownEntitySchemaIds, now)
    } as RelationSchemaDbResult;
  });

  apply<DocumentTypeDbResult>('document_type', 'documentTypes', (item, current) => {
    const payload = body(item);
    return {
      id: item.item_id,
      workspace,
      description: '',
      fields: [],
      color: null,
      icon: null,
      archived: false,
      aiActions: [],
      created_at: now,
      ...current,
      ...payload,
      updated_at: now
    } as DocumentTypeDbResult;
  });

  // Compile shared groups into schemas; failures become issues and the uncompiled row is kept.
  const compileAll = <T extends { id: string }>(
    kind: SchemaDraftKind,
    rows: T[],
    compile: (row: T) => T
  ): T[] =>
    rows.map(row => {
      try {
        return compile(row);
      } catch (error) {
        const touched = items.some(i => i.kind === kind && i.item_id === row.id);
        // Only report compile failures for rows the draft touched, or that depend on touched groups.
        issues.push({
          kind,
          itemId: row.id,
          op: touched ? (items.find(i => i.item_id === row.id)?.op ?? 'update') : 'update',
          message: messageOf(error)
        });
        return row;
      }
    });

  draft.schemas = compileAll('entity_schema', draft.schemas, s =>
    compileSchemaWithSharedGroups(s, draft.fieldGroups)
  );
  draft.relationSchemas = compileAll('relation_schema', draft.relationSchemas, s =>
    compileRelationSchemaWithSharedGroups(s, draft.fieldGroups)
  );

  return { live, draft, changes, issues };
};

/** Loads the live catalog (compiled) and applies the draft over it. Read-only. */
export const buildDraftCatalog = async (
  db: DatabaseAdapter,
  workspace: string,
  items: readonly SchemaDraftItemDbResult[],
  now: Date = new Date()
): Promise<DraftCatalog> => {
  const [schemas, relationSchemas, documentTypes, enums, fieldGroups, categories, teams] =
    await Promise.all([
      db.catalog.listSchemas(workspace),
      db.relation.listRelationSchemas(workspace),
      db.document.listDocumentTypes(workspace, true),
      db.catalog.listEnums(workspace),
      db.catalog.listSharedFieldGroups(workspace),
      db.catalog.listCategories(workspace),
      db.workspace.listTeams(workspace)
    ]);
  return applyDraftItems(
    { schemas, relationSchemas, documentTypes, enums, fieldGroups, categories },
    items,
    { workspace, teamIds: new Set(teams.map(t => t.id)), now }
  );
};
