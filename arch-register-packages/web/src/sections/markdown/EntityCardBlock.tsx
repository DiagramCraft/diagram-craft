import { useNavigate } from '@tanstack/react-router';
import { TypeBadge } from '../../components/TypeBadge';
import { StatusChip } from '../../components/StatusChip';
import { useEntity } from '../../hooks/useEntities';
import { resolveSchemaColor } from '../../lib/api';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { entityDetailRoute, asEntityPublicId } from '../../routes/publicObjectRoutes';
import styles from './EntityCardBlock.module.css';

export const EntityCardBlock = ({ id }: { id: string }) => {
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();
  const { data: entity, isLoading, isError } = useEntity(workspaceSlug, id);
  const navigate = useNavigate();

  if (!id) return null;

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  if (isError || !entity) {
    return (
      <div className={`${styles.card} ${styles.error}`}>
        <span className={styles.errorText}>Entity not found: {id}</span>
      </div>
    );
  }

  const schemaIdx = schemas.findIndex(s => s.id === entity._schema?.id);
  const schema = schemaIdx >= 0 ? schemas[schemaIdx] : undefined;
  const color = schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={18} />
        <span className={styles.name}>{entity._name}</span>
        {schema && <span className={styles.schema}>{schema.name}</span>}
      </div>
      {(entity._lifecycle ?? entity._owner) && (
        <div className={styles.meta}>
          {entity._lifecycle && (
            <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
          )}
          {entity._owner && (
            <span className={styles.owner}>{entity._owner.name}</span>
          )}
        </div>
      )}
      <button
        type="button"
        className={styles.link}
        onClick={() => navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(id)))}
      >
        View in catalog →
      </button>
    </div>
  );
};
