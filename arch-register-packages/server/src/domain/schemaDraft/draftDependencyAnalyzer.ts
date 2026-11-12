import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { buildValidationPlan } from '../catalog/entityValidationRules';
import { buildDerivedPlan } from '../derived/derivedFields';
import { validateEntityQueryIR } from '../catalog/entityQueryIRValidator';
import type { RelationSchemaCatalog, SchemaCatalog } from '../catalog/entityQueryIRResolution';
import type { CatalogSnapshot, DraftCatalog } from './draftCatalog';
import type { SchemaDraftKind } from './db/schemaDraftDatabase';

export type DraftFindingSeverity = 'blocking' | 'warning';

export type DraftFindingCategory =
  | 'draft_item'
  | 'saved_view'
  | 'entity_drawer'
  | 'template'
  | 'validation_rule'
  | 'derived_field'
  | 'enum_reference'
  | 'field_group_reference'
  | 'category_reference'
  | 'relation_endpoint'
  | 'automation_rule'
  | 'capability_binding'
  | 'external_field';

export type DraftFinding = {
  severity: DraftFindingSeverity;
  category: DraftFindingCategory;
  /** The draft item that causes the finding. */
  draftItem: { kind: SchemaDraftKind; itemId: string; name: string | null };
  /** The affected object (a schema, a saved view, a drawer, ...). */
  subject: { type: string; id: string; name: string };
  message: string;
};

/** Stored objects that embed an entity query and can break when the schema catalog changes. */
export type QueryConsumer = {
  type: 'saved_view' | 'entity_drawer';
  id: string;
  name: string;
  query: EntityQuery;
};

export type DependencyInputs = {
  queryConsumers: readonly QueryConsumer[];
};

const toQueryCatalogs = (snapshot: CatalogSnapshot) => ({
  schemas: new Map(snapshot.schemas.map(s => [s.id, s])) as SchemaCatalog,
  relationSchemas: new Map(snapshot.relationSchemas.map(s => [s.id, s])) as RelationSchemaCatalog
});

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Finds what a draft would break. Everything here is read-only and works on the two catalog
 * snapshots; a problem that already exists in the live catalog is not reported, so findings are
 * attributable to the draft.
 */
export const analyzeDraftDependencies = (
  catalog: DraftCatalog,
  inputs: DependencyInputs
): DraftFinding[] => {
  const findings: DraftFinding[] = [];
  const { live, draft } = catalog;

  const originFor = (kind: SchemaDraftKind, itemId: string) => {
    const change = catalog.changes.find(c => c.kind === kind && c.itemId === itemId);
    return { kind, itemId, name: change?.name ?? change?.liveName ?? null };
  };
  const deleted = (kind: SchemaDraftKind) =>
    catalog.changes.filter(c => c.kind === kind && c.op === 'delete').map(c => c.itemId);

  // Draft items that could not be applied at all.
  for (const issue of catalog.issues) {
    findings.push({
      severity: 'blocking',
      category: 'draft_item',
      draftItem: originFor(issue.kind, issue.itemId),
      subject: {
        type: issue.kind,
        id: issue.itemId,
        name: originFor(issue.kind, issue.itemId).name ?? issue.itemId
      },
      message: issue.message
    });
  }

  // Enum references: deleted enum still used by a select field.
  const deletedEnums = new Set(deleted('enum'));
  const checkFields = (
    type: 'entity_schema' | 'relation_schema',
    rows: {
      id: string;
      name: string;
      fields: { id: string; name: string; type: string; enumId?: string }[];
    }[]
  ) => {
    for (const row of rows) {
      for (const field of row.fields) {
        if (field.type === 'select' && field.enumId && deletedEnums.has(field.enumId)) {
          findings.push({
            severity: 'blocking',
            category: 'enum_reference',
            draftItem: originFor('enum', field.enumId),
            subject: { type, id: row.id, name: row.name },
            message: `Field "${field.name}" in "${row.name}" uses the enum being deleted`
          });
        }
      }
    }
  };
  checkFields('entity_schema', draft.schemas as never);
  checkFields('relation_schema', draft.relationSchemas as never);

  // Category references.
  const deletedCategories = new Set(deleted('category'));
  const categoryOwners = [
    ...draft.schemas.map(s => ({ type: 'entity_schema', row: s })),
    ...draft.relationSchemas.map(s => ({ type: 'relation_schema', row: s })),
    ...draft.enums.map(s => ({ type: 'enum', row: s })),
    ...draft.fieldGroups.map(s => ({ type: 'field_group', row: s }))
  ];
  for (const { type, row } of categoryOwners) {
    const categoryId = (row as { category_id?: string | null }).category_id;
    if (categoryId && deletedCategories.has(categoryId)) {
      findings.push({
        severity: 'blocking',
        category: 'category_reference',
        draftItem: originFor('category', categoryId),
        subject: { type, id: row.id, name: row.name },
        message: `"${row.name}" belongs to the category being deleted`
      });
    }
  }

  // Relation endpoints pointing at deleted entity schemas.
  const deletedSchemas = new Set(deleted('entity_schema'));
  for (const relation of draft.relationSchemas) {
    for (const side of ['in_schema_ids', 'out_schema_ids'] as const) {
      const ids = relation[side];
      if (ids === 'any') continue;
      for (const id of ids) {
        if (deletedSchemas.has(id)) {
          findings.push({
            severity: 'blocking',
            category: 'relation_endpoint',
            draftItem: originFor('entity_schema', id),
            subject: { type: 'relation_schema', id: relation.id, name: relation.name },
            message: `Relation type "${relation.name}" has the ${side === 'in_schema_ids' ? 'in' : 'out'} endpoint on a schema being deleted`
          });
        }
      }
    }
  }

  // Per-schema checks on touched entity schemas: validation rules, derived-field graph, templates.
  const touchedSchemaIds = new Set(
    catalog.changes.filter(c => c.kind === 'entity_schema' && c.op !== 'delete').map(c => c.itemId)
  );
  for (const schema of draft.schemas.filter(s => touchedSchemaIds.has(s.id))) {
    const origin = originFor('entity_schema', schema.id);
    const subject = { type: 'entity_schema', id: schema.id, name: schema.name };

    try {
      buildValidationPlan(schema.validation_rules ?? [], 'entity');
    } catch (error) {
      findings.push({
        severity: 'blocking',
        category: 'validation_rule',
        draftItem: origin,
        subject,
        message: messageOf(error)
      });
    }
    try {
      buildDerivedPlan(schema.fields as never, 'entity' as never);
    } catch (error) {
      findings.push({
        severity: 'blocking',
        category: 'derived_field',
        draftItem: origin,
        subject,
        message: messageOf(error)
      });
    }
    const fieldIds = new Set(schema.fields.map(f => f.id));
    for (const template of schema.templates ?? []) {
      const missing = Object.keys(template.values?.fields ?? {}).filter(id => !fieldIds.has(id));
      if (missing.length > 0) {
        findings.push({
          severity: 'blocking',
          category: 'template',
          draftItem: origin,
          subject,
          message: `Template "${template.name}" sets fields that no longer exist: ${missing.join(', ')}`
        });
      }
    }
  }

  // Stored queries (saved views, drawers) that validated against live but fail against the draft.
  const liveCatalogs = toQueryCatalogs(live);
  const draftCatalogs = toQueryCatalogs(draft);
  const queryOrigin = (query: EntityQuery) => {
    const schemaId = query.schemaId;
    const touched = catalog.changes.find(c => c.itemId === schemaId);
    return touched ? originFor(touched.kind, touched.itemId) : null;
  };
  for (const consumer of inputs.queryConsumers) {
    const before = validateEntityQueryIR(
      consumer.query,
      liveCatalogs.schemas,
      null,
      liveCatalogs.relationSchemas
    );
    if (!before.ok) continue;
    const after = validateEntityQueryIR(
      consumer.query,
      draftCatalogs.schemas,
      null,
      draftCatalogs.relationSchemas
    );
    if (after.ok) continue;
    findings.push({
      severity: 'blocking',
      category: consumer.type,
      draftItem: queryOrigin(consumer.query) ?? { kind: 'entity_schema', itemId: '', name: null },
      subject: { type: consumer.type, id: consumer.id, name: consumer.name },
      message: after.errors.map(e => e.message).join('; ')
    });
  }

  return findings;
};
