import { Link } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useEntity } from '../../../../../hooks/useEntities';
import { TypeBadge } from '../../../../../components/TypeBadge';
import { StatusChip } from '../../../../../components/StatusChip';
import { resolveSchemaColor } from '../../../../../lib/schemaPresentation';
import { entityDetailRoute, asEntityPublicId } from '../../../../../routes/publicObjectRoutes';
import styles from './EntityMention.module.css';

export const EntityMention = ({ id }: { id: string }) => {
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();
  const { data: entity, isLoading, isError } = useEntity(workspaceSlug, id);

  if (!id) return null;

  if (isLoading) {
    return <span className={`${styles.mention} ${styles.mentionLoading}`}>{id}</span>;
  }

  if (isError || !entity) {
    return <span className={`${styles.mention} ${styles.mentionUnavailable}`}>not found</span>;
  }

  const schemaIdx = schemas.findIndex(s => s.id === entity._schema?.id);
  const schema = schemaIdx >= 0 ? schemas[schemaIdx] : undefined;
  const color = schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)';

  return (
    <Link
      {...entityDetailRoute(workspaceSlug, asEntityPublicId(id))}
      className={styles.mention}
      onClick={event => event.stopPropagation()}
    >
      <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />
      <span className={styles.name}>{entity._name}</span>
      {schema && (
        <>
          <span className={styles.separator}>·</span>
          <span className={styles.schema}>{schema.name}</span>
        </>
      )}
      {entity._lifecycle && (
        <>
          <span className={styles.separator}>·</span>
          <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
        </>
      )}
    </Link>
  );
};
