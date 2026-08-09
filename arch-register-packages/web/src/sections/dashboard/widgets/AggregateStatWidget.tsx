import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { useEntityCount } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../markdown/MdxContext';
import styles from './AggregateStatWidget.module.css';

export type AggregateStatWidgetConfig = {
  schema: string;
  owner?: string;
  lifecycle?: string;
  numeratorCondition?: FilterCondition;
  label?: string;
  showLink?: boolean;
};

type Props = {
  config: AggregateStatWidgetConfig;
};

export const AggregateStatWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { renderMode } = useMdxContext();
  const showInlineLabel = renderMode !== 'dashboard';
  const showLink = config.showLink ?? true;

  const baseFilter = {
    schemaId: config.schema,
    owner: config.owner || undefined,
    lifecycle: config.lifecycle || undefined
  };
  const hasSchema = !!config.schema;
  const hasCondition = !!config.numeratorCondition;

  const { data: denominator, isLoading: loadingTotal } = useEntityCount(workspaceSlug, baseFilter, {
    enabled: !!workspaceSlug && hasSchema
  });
  const { data: numerator, isLoading: loadingMatch } = useEntityCount(
    workspaceSlug,
    { ...baseFilter, conditions: config.numeratorCondition ? [config.numeratorCondition] : [] },
    { enabled: !!workspaceSlug && hasSchema && hasCondition }
  );

  if (!hasSchema || !hasCondition) {
    return <div className={`${styles.message} dim`}>This widget is not fully configured.</div>;
  }

  if (loadingTotal || loadingMatch) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const total = denominator?.total ?? 0;
  const matched = numerator?.total ?? 0;
  const percent = total > 0 ? Math.round((matched / total) * 100) : 0;
  const schemaName = schemas.find(s => s.id === config.schema)?.name ?? config.schema;
  const displayLabel = config.label ?? schemaName;

  return (
    <div className={styles.card}>
      <div className={styles.number}>{percent}%</div>
      {showInlineLabel && <div className={styles.label}>{displayLabel}</div>}
      {showLink && (
        <button
          type="button"
          className={styles.viewLink}
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/entities',
              params: { workspaceSlug },
              search: {
                filters: JSON.stringify([
                  { fieldId: '_schemaId', op: 'equals' as const, value: config.schema }
                ])
              }
            })
          }
        >
          View in catalog <TbArrowRight size={12} />
        </button>
      )}
    </div>
  );
};
