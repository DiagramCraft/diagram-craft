import type { DatabaseAdapter } from '../../db/database';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
import type { SchemaDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';

type VersionedSchema = FieldGroupSchemaShape & { created_at: Date };

/**
 * Resolves the schema that was applicable at a historical point in time. The current schema is
 * only a safe fallback when it already existed at that point; otherwise an unavailable schema is
 * represented by null so external serializers can fail closed.
 */
export const selectSchemaAt = <TCurrent extends VersionedSchema, TVersion extends VersionedSchema>(
  current: TCurrent | null,
  versions: TVersion[],
  asOf: Date
): FieldGroupSchemaShape | null => {
  const historical = versions
    .filter(version => version.created_at <= asOf)
    .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0];
  if (historical) return historical;
  if (current && current.created_at <= asOf) return current;
  return null;
};

export const getEntitySchemaAt = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  asOf: Date
) => {
  const [current, versions] = await Promise.all([
    db.catalog.getSchema(workspace, schemaId),
    db.catalog.listSchemaVersions(workspace, schemaId)
  ]);
  return selectSchemaAt(current, versions, asOf);
};

export const getRelationSchemaAt = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  asOf: Date
) => {
  const [current, versions] = await Promise.all([
    db.relation.getRelationSchema(workspace, schemaId),
    db.relation.listRelationSchemaVersions(workspace, schemaId)
  ]);
  return selectSchemaAt(current, versions, asOf);
};

export type HistoricalSchemaCatalog = Map<string, SchemaDbResult | null>;

/**
 * Resolves the entity schemas needed by a temporal read. Keep the current schema metadata so
 * callers can continue to build API records, but replace its fields/groups with the definition
 * that was applicable at `asOf`. A missing historical definition is deliberately retained as
 * null so temporal serializers can fail closed instead of falling back to the current schema.
 */
export const resolveEntitySchemaCatalogAt = async (
  db: DatabaseAdapter,
  workspace: string,
  schemas: SchemaDbResult[],
  asOf: Date
): Promise<HistoricalSchemaCatalog> => {
  const resolved = await Promise.all(
    schemas.map(async schema => {
      const historical = await getEntitySchemaAt(db, workspace, schema.id, asOf);
      return [
        schema.id,
        historical
          ? {
              ...schema,
              fields: historical.fields as SchemaDbResult['fields'],
              groups: historical.groups as SchemaDbResult['groups']
            }
          : null
      ] as const;
    })
  );
  return new Map(resolved);
};

export const availableSchemaCatalog = (
  schemas: HistoricalSchemaCatalog
): Map<string, SchemaDbResult> =>
  new Map([...schemas].filter((entry): entry is [string, SchemaDbResult] => entry[1] != null));

export type HistoricalRelationSchemaCatalog = Map<string, RelationSchemaDbResult | null>;

export const availableRelationSchemaCatalog = (
  schemas: HistoricalRelationSchemaCatalog
): Map<string, RelationSchemaDbResult> =>
  new Map(
    [...schemas].filter((entry): entry is [string, RelationSchemaDbResult] => entry[1] != null)
  );

/** Relation counterpart of resolveEntitySchemaCatalogAt. */
export const resolveRelationSchemaCatalogAt = async (
  db: DatabaseAdapter,
  workspace: string,
  schemas: RelationSchemaDbResult[],
  asOf: Date
): Promise<HistoricalRelationSchemaCatalog> => {
  const resolved = await Promise.all(
    schemas.map(async schema => {
      const historical = await getRelationSchemaAt(db, workspace, schema.id, asOf);
      return [
        schema.id,
        historical
          ? {
              ...schema,
              fields: historical.fields as RelationSchemaDbResult['fields'],
              groups: historical.groups as RelationSchemaDbResult['groups'],
              unique_endpoint_pair:
                (historical as RelationSchemaDbResult).unique_endpoint_pair ?? false
            }
          : null
      ] as const;
    })
  );
  return new Map(resolved);
};
