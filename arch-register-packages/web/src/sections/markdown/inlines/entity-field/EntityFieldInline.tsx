import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import { useEntity } from '../../../../hooks/useEntities';
import { renderSchemaFieldValue, STANDARD_FIELD_IDS } from '../../blocks/entity-card/EntityCardBlock';
import styles from './EntityFieldInline.module.css';

const resolveFieldValue = (
  entity: Record<string, unknown> & {
    _owner?: { name: string } | null;
    _lifecycle?: { name: string } | null;
    _description?: string | null;
    _tags?: string[];
    _schema?: { id?: string } | null;
  },
  field: string,
  schemas: { id: string; fields: { id: string; name: string; type: string }[] }[]
): string | null => {
  if (field === 'owner') return entity._owner?.name ?? null;
  if (field === 'lifecycle') return entity._lifecycle?.name ?? null;
  if (field === 'description') return typeof entity._description === 'string' ? entity._description : null;
  if (field === 'tags') {
    const tags = entity._tags ?? [];
    return Array.isArray(tags) && tags.length > 0 ? tags.join(', ') : null;
  }

  // Schema field
  if (!STANDARD_FIELD_IDS.has(field)) {
    const schema = schemas.find(s => s.id === (entity._schema as { id?: string } | null)?.id);
    const fieldDef = schema?.fields.find(f => f.id === field);
    if (!fieldDef) return null;
    // biome-ignore lint/suspicious/noExplicitAny: entity fields are dynamic
    return renderSchemaFieldValue(fieldDef as any, (entity as Record<string, unknown>)[field]);
  }

  return null;
};

export const EntityFieldInline = ({ id, field }: { id: string; field: string }) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { data: entity, isLoading, isError } = useEntity(workspaceSlug, id);

  if (!id || !field) return null;

  if (isLoading) {
    return <span className={`${styles.chip} ${styles.chipLoading}`}>{id}·{field}</span>;
  }

  if (isError || !entity) {
    return <span className={`${styles.chip} ${styles.chipUnavailable}`}>unavailable</span>;
  }

  const value = resolveFieldValue(
    entity as Parameters<typeof resolveFieldValue>[0],
    field,
    schemas as Parameters<typeof resolveFieldValue>[2]
  );

  if (value == null) {
    return <span className={`${styles.chip} ${styles.chipUnavailable}`}>unavailable</span>;
  }

  return <span className={styles.chip}>{value}</span>;
};
