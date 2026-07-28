import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import { useEntities, useEntityFacets } from '../../../../../hooks/useEntities';
import { useProject, useProjects } from '../../../../../hooks/useProjects';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { asProjectPublicId, projectDetailRoute } from '../../../../../routes/publicObjectRoutes';
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
  /** Omit the card's own border/background — used when a parent already provides panel chrome. */
  bare?: boolean;
};

const cardClassName = (bare?: boolean) =>
  bare ? `${styles.card} ${styles.cardBare}` : styles.card;

export const EntityMetric = ({ schema, owner, lifecycle, label, metricType, bare }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { projectId, renderMode } = useMdxContext();
  const resolvedMetricType = metricType ?? 'entity-count';
  const showInlineLabel = renderMode !== 'dashboard';

  if (resolvedMetricType === 'diagram-count' && projectId) {
    return (
      <ProjectDiagramCountMetric
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        label={label}
        bare={bare}
        showInlineLabel={showInlineLabel}
      />
    );
  }

  if (resolvedMetricType === 'project-count') {
    return (
      <ProjectCountMetric
        workspaceSlug={workspaceSlug}
        label={label}
        bare={bare}
        showInlineLabel={showInlineLabel}
      />
    );
  }

  if (resolvedMetricType === 'diagram-count') {
    return (
      <DiagramCountMetric
        workspaceSlug={workspaceSlug}
        label={label}
        bare={bare}
        showInlineLabel={showInlineLabel}
      />
    );
  }

  if (resolvedMetricType === 'completeness-percent') {
    return (
      <CompletenessPercentMetric
        workspaceSlug={workspaceSlug}
        label={label}
        bare={bare}
        showInlineLabel={showInlineLabel}
      />
    );
  }

  return (
    <EntityCountMetric
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      schema={schema}
      owner={owner}
      lifecycle={lifecycle}
      label={label}
      navigate={navigate}
      totalEntityCount={schemas.reduce((sum, s) => sum + s.entity_count, 0)}
      bare={bare}
      showInlineLabel={showInlineLabel}
    />
  );
};

const EntityCountMetric = ({
  workspaceSlug,
  projectId,
  schema,
  owner,
  lifecycle,
  label,
  navigate,
  totalEntityCount,
  bare,
  showInlineLabel
}: {
  workspaceSlug: string;
  projectId?: string;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
  navigate: ReturnType<typeof useNavigate>;
  totalEntityCount: number;
  bare?: boolean;
  showInlineLabel?: boolean;
}) => {
  const hasFilter = hasEntityMetricFilter({ schema, owner, lifecycle }) || !!projectId;

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    {
      schemaId: schema === '' ? undefined : schema,
      owner: owner === '' ? undefined : owner,
      lifecycle: lifecycle === '' ? undefined : lifecycle,
      projectId,
      projectScope: projectId ? 'project' : undefined,
      view: 'summary',
      limit: 1000
    },
    { enabled: !!workspaceSlug && hasFilter }
  );

  if (!hasFilter) {
    return (
      <div className={cardClassName(bare)}>
        <div className={styles.number}>{totalEntityCount}</div>
        {showInlineLabel && <div className={styles.label}>{label ?? 'Entities'}</div>}
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
    <div className={cardClassName(bare)}>
      <div className={styles.number}>{count}</div>
      {showInlineLabel && <div className={styles.label}>{displayLabel}</div>}
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
          const filters = conditions.length > 0 ? JSON.stringify(conditions) : undefined;

          if (projectId) {
            navigate(
              projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
                section: 'entities' as const,
                filters
              })
            );
            return;
          }

          navigate({
            to: '/$workspaceSlug/entities',
            params: { workspaceSlug },
            search: { filters }
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
  label,
  bare,
  showInlineLabel
}: {
  workspaceSlug: string;
  label?: string;
  bare?: boolean;
  showInlineLabel?: boolean;
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
    <div className={cardClassName(bare)}>
      <div className={styles.number}>{projects.length}</div>
      {showInlineLabel && <div className={styles.label}>{label ?? 'Projects'}</div>}
    </div>
  );
};

const ProjectDiagramCountMetric = ({
  workspaceSlug,
  projectId,
  label,
  bare,
  showInlineLabel
}: {
  workspaceSlug: string;
  projectId: string;
  label?: string;
  bare?: boolean;
  showInlineLabel?: boolean;
}) => {
  const { data: project, isLoading } = useProject(workspaceSlug, projectId);

  if (isLoading || !project) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  return (
    <div className={cardClassName(bare)}>
      <div className={styles.number}>{project.file_count}</div>
      {showInlineLabel && <div className={styles.label}>{label ?? 'Diagrams'}</div>}
    </div>
  );
};

const DiagramCountMetric = ({
  workspaceSlug,
  label,
  bare,
  showInlineLabel
}: {
  workspaceSlug: string;
  label?: string;
  bare?: boolean;
  showInlineLabel?: boolean;
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
    <div className={cardClassName(bare)}>
      <div className={styles.number}>{totalFiles}</div>
      {showInlineLabel && <div className={styles.label}>{label ?? 'Diagrams'}</div>}
    </div>
  );
};

const CompletenessPercentMetric = ({
  workspaceSlug,
  label,
  bare,
  showInlineLabel
}: {
  workspaceSlug: string;
  label?: string;
  bare?: boolean;
  showInlineLabel?: boolean;
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
    <div className={cardClassName(bare)}>
      <div className={styles.number}>{percent}%</div>
      {showInlineLabel && <div className={styles.label}>{label ?? 'Well documented'}</div>}
    </div>
  );
};
