import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight } from 'react-icons/tb';
import { useEntities, useEntityFacets } from '../../../../../hooks/useEntities';
import { useProject, useProjects } from '../../../../../hooks/useProjects';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { asProjectPublicId, projectDetailRoute } from '../../../../../routes/publicObjectRoutes';
import styles from './Metric.module.css';
import type { MetricType } from './types';

export const hasMetricFilter = (props: {
  schema?: string;
  owner?: string;
  lifecycle?: string;
}): boolean => !!(props.schema || props.owner || props.lifecycle);

type Props = {
  schema?: string;
  owner?: string;
  lifecycle?: string;
  label?: string;
  metricType?: MetricType;
  /** Omit the card's own border/background — used when a parent already provides panel chrome. */
  bare?: boolean;
  /** Whether to show a link to the relevant list/catalog. Defaults to true. */
  showLink?: boolean;
};

const cardClassName = (bare?: boolean) =>
  bare ? `${styles.card} ${styles.cardBare}` : styles.card;

const ViewLink = ({ onClick, children }: { onClick: () => void; children: string }) => (
  <button type="button" className={styles.viewLink} onClick={onClick}>
    {children} <TbArrowRight size={12} />
  </button>
);

export const Metric = ({ schema, owner, lifecycle, label, metricType, bare, showLink }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { projectId, renderMode } = useMdxContext();
  const resolvedMetricType = metricType ?? 'entity-count';
  const showInlineLabel = renderMode !== 'dashboard';
  const resolvedShowLink = showLink ?? true;

  if (resolvedMetricType === 'diagram-count' && projectId) {
    return (
      <ProjectDiagramCountMetric
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        label={label}
        bare={bare}
        showInlineLabel={showInlineLabel}
        showLink={resolvedShowLink}
        navigate={navigate}
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
        showLink={resolvedShowLink}
        navigate={navigate}
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
        showLink={resolvedShowLink}
        navigate={navigate}
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
        showLink={resolvedShowLink}
        navigate={navigate}
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
      showLink={resolvedShowLink}
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
  showInlineLabel,
  showLink
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
  showLink: boolean;
}) => {
  const hasFilter = hasMetricFilter({ schema, owner, lifecycle }) || !!projectId;

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

  const navigateToCatalog = () => {
    const conditions = [
      ...(schema ? [{ fieldId: '_schemaId', op: 'equals' as const, value: schema }] : []),
      ...(lifecycle ? [{ fieldId: '_lifecycle', op: 'equals' as const, value: lifecycle }] : []),
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
  };

  if (!hasFilter) {
    return (
      <div className={cardClassName(bare)}>
        <div className={styles.number}>{totalEntityCount}</div>
        {showInlineLabel && <div className={styles.label}>{label ?? 'Entities'}</div>}
        {showLink && <ViewLink onClick={navigateToCatalog}>View in catalog</ViewLink>}
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
      {showLink && <ViewLink onClick={navigateToCatalog}>View in catalog</ViewLink>}
    </div>
  );
};

const ProjectCountMetric = ({
  workspaceSlug,
  label,
  bare,
  showInlineLabel,
  showLink,
  navigate
}: {
  workspaceSlug: string;
  label?: string;
  bare?: boolean;
  showInlineLabel?: boolean;
  showLink: boolean;
  navigate: ReturnType<typeof useNavigate>;
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
      {showLink && (
        <ViewLink
          onClick={() => navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } })}
        >
          View projects
        </ViewLink>
      )}
    </div>
  );
};

const ProjectDiagramCountMetric = ({
  workspaceSlug,
  projectId,
  label,
  bare,
  showInlineLabel,
  showLink,
  navigate
}: {
  workspaceSlug: string;
  projectId: string;
  label?: string;
  bare?: boolean;
  showInlineLabel?: boolean;
  showLink: boolean;
  navigate: ReturnType<typeof useNavigate>;
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
      {showLink && (
        <ViewLink onClick={() => navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)))}>
          View diagrams
        </ViewLink>
      )}
    </div>
  );
};

const DiagramCountMetric = ({
  workspaceSlug,
  label,
  bare,
  showInlineLabel,
  showLink,
  navigate
}: {
  workspaceSlug: string;
  label?: string;
  bare?: boolean;
  showInlineLabel?: boolean;
  showLink: boolean;
  navigate: ReturnType<typeof useNavigate>;
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
      {showLink && (
        <ViewLink onClick={() => navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } })}>
          View diagrams
        </ViewLink>
      )}
    </div>
  );
};

const CompletenessPercentMetric = ({
  workspaceSlug,
  label,
  bare,
  showInlineLabel,
  showLink,
  navigate
}: {
  workspaceSlug: string;
  label?: string;
  bare?: boolean;
  showInlineLabel?: boolean;
  showLink: boolean;
  navigate: ReturnType<typeof useNavigate>;
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
      {showLink && (
        <ViewLink onClick={() => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } })}>
          View in catalog
        </ViewLink>
      )}
    </div>
  );
};
