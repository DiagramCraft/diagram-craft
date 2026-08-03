import type { DatabaseAdapter } from '../../db/database';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';

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
