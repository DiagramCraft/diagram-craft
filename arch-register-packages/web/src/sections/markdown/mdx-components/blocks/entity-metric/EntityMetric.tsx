import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import { useEntities, useEntityFacets } from '../../../../../hooks/useEntities';
import { useProjects } from '../../../../../hooks/useProjects';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import styles from './EntityMetric.module.css';
import type { EntityMetricType } from './types';

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
  metricType?: EntityMetricType;
};

export const EntityMetric = ({ schema, owner, lifecycle, label, metricType }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const resolvedMetricType = metricType ?? 'entity-count';

  if (resolvedMetricType === 'project-count') {
    return <ProjectCountMetric workspaceSlug={workspaceSlug} label={label} />;
  }

  if (resolvedMetricType === 'diagram-count') {
    return <DiagramCountMetric workspaceSlug={workspaceSlug} label={label} />;
  }

  if (resolvedMetricType === 'completeness-percent') {
    return <CompletenessPercentMetric workspaceSlug={workspaceSlug} label={label} />;
  }

  return (
    <EntityCountMetric
      workspaceSlug={workspaceSlug}
      schema={schema}
      owner={owner}
      lifecycle={lifecycle}
      label={label}
      navigate={navigate}
      totalEntityCount={schemas.reduce((sum, s) => sum + s.entity_count, 0)}
    />
  );
};

const EntityCountMetric = ({
  workspaceSlug,
  schema,
  owner,
  lifecycle,
  label,
  navigate,
  totalEntityCount
}: {
  workspaceSlug: string;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
  navigate: ReturnType<typeof useNavigate>;
  totalEntityCount: number;
}) => {
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
      <div className={styles.card}>
        <div className={styles.number}>{totalEntityCount}</div>
        <div className={styles.label}>{label ?? 'Entities'}</div>
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
  const displayLabel = label ?? 'Entities';

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
            ...(lifecycle
              ? [{ fieldId: '_lifecycle', op: 'equals' as const, value: lifecycle }]
              : []),
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

const ProjectCountMetric = ({
  workspaceSlug,
  label
}: {
  workspaceSlug: string;
  label?: string;
}) => {
  const { data: projects = [], isLoading } = useProjects(workspaceSlug);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.number}>{projects.length}</div>
      <div className={styles.label}>{label ?? 'Projects'}</div>
    </div>
  );
};

const DiagramCountMetric = ({
  workspaceSlug,
  label
}: {
  workspaceSlug: string;
  label?: string;
}) => {
  const { data: projects = [], isLoading } = useProjects(workspaceSlug);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const totalFiles = projects.reduce((sum, p) => sum + p.file_count, 0);

  return (
    <div className={styles.card}>
      <div className={styles.number}>{totalFiles}</div>
      <div className={styles.label}>{label ?? 'Diagrams'}</div>
    </div>
  );
};

const CompletenessPercentMetric = ({
  workspaceSlug,
  label
}: {
  workspaceSlug: string;
  label?: string;
}) => {
  const { data: facets, isLoading } = useEntityFacets(workspaceSlug);

  if (isLoading || !facets) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const { below50, below80, above80 } = facets.completeness;
  const total = below50 + below80 + above80;
  const percent = total > 0 ? Math.round((above80 / total) * 100) : 0;

  return (
    <div className={styles.card}>
      <div className={styles.number}>{percent}%</div>
      <div className={styles.label}>{label ?? 'Well documented'}</div>
    </div>
  );
};
