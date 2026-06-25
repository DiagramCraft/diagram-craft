import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import { useEntities } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import styles from './EntityMetric.module.css';

export const hasEntityMetricFilter = (props: {
  schema?: string;
  owner?: string;
  lifecycle?: string;
}): boolean => !!(props.schema || props.owner || props.lifecycle);

type Props = {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
};

export const EntityMetric = ({ schema, owner, lifecycle, label }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();

  const hasFilter = hasEntityMetricFilter({ schema, owner, lifecycle });

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    {
      schemaId: schema === '' ? undefined : schema,
      owner: owner === '' ? undefined : owner,
      lifecycle: lifecycle === '' ? undefined : lifecycle,
      view: 'summary',
      limit: 1000
    },
    { enabled: !!workspaceSlug && hasFilter }
  );

  if (!hasFilter) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>No filters configured.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const count = entities.length;
  const displayLabel = label || 'Entities';

  return (
    <div className={styles.card}>
      <div className={styles.number}>{count}</div>
      <div className={styles.label}>{displayLabel}</div>
      <button
        type="button"
        className={styles.viewLink}
        onClick={() => {
          const conditions = [
            ...(schema ? [{ fieldId: '_schemaId', op: 'equals' as const, value: schema }] : []),
            ...(lifecycle ? [{ fieldId: '_lifecycle', op: 'equals' as const, value: lifecycle }] : []),
            ...(owner ? [{ fieldId: '_owner', op: 'equals' as const, value: owner }] : [])
          ];
          navigate({
            to: '/$workspaceSlug/entities',
            params: { workspaceSlug },
            search: { filters: conditions.length > 0 ? JSON.stringify(conditions) : undefined }
          });
        }}
      >
        View in catalog <TbArrowRight size={12} />
      </button>
    </div>
  );
};
