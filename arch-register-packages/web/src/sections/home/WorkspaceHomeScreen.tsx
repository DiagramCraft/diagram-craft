import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import styles from './WorkspaceHomeScreen.module.css';
import { Title } from '../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../components/Chip';
import { TypeBadge } from '../../components/TypeBadge';
import {
  TbDatabase,
  TbFolders,
  TbFileVector,
  TbGitBranch,
  TbPlus,
  TbChevronRight,
  TbChartBar
} from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { useAuditLog } from '../../hooks/useAudit';
import { useEntityFacets } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Project } from '@arch-register/api-types/projectContract';
import { AuditLogEntry } from '@arch-register/api-types/auditContract';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDetailRoute
} from '../../routes/publicObjectRoutes';

const PROJECT_STATUS_META = {
  draft: { label: 'Draft' },
  active: { label: 'Active' },
  complete: { label: 'Complete' },
  cancelled: { label: 'Cancelled' }
} as const;

const MAX_RECENT_ACTIVITY_ENTRIES = 15;

export const WorkspaceHomeScreen = () => {
  const navigate = useNavigate();
  const {
    workspace,
    workspaceSlug,
    schemas,
    projects,
    permissions,
    openAddProjectDialog,
    openAddEntityDialog
  } = useWorkspaceContext();
  const { canViewAudit, canViewSchemas, canCreateProjects, canCreateEntities } =
    permissions;
  const collapsedProjectCount = 6;
  const [showAllProjects, setShowAllProjects] = useState(false);

  const totalEntities = schemas.reduce((sum, s) => sum + s.entity_count, 0);
  const totalFiles = projects.reduce((sum, p) => sum + p.file_count, 0);
  const nonArchivedProjects = projects.filter(p => p.status !== 'complete' && p.status !== 'cancelled');
  const hasMoreProjects = nonArchivedProjects.length > collapsedProjectCount;
  const visibleProjects = showAllProjects
    ? projects
    : nonArchivedProjects.slice(0, collapsedProjectCount);

  const { data: facets } = useEntityFacets(workspaceSlug);

  // Fetch recent activity from audit log using TanStack Query
  const { data: recentActivity = [], isLoading: activityLoading } = useAuditLog(
    workspaceSlug,
    { limit: MAX_RECENT_ACTIVITY_ENTRIES },
    { enabled: canViewAudit }
  );

  if (!workspace) return null;

  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const handleActivityClick = (entry: AuditLogEntry) => {
    switch (entry.entity_type) {
      case 'entity':
        if (entry.public_id) navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entry.public_id)));
        break;
      case 'project':
        if (entry.public_id) {
          navigate(
            projectDetailRoute(workspaceSlug, asProjectPublicId(entry.public_id), {
              tab: 'projects' as const,
              section: 'home' as const
            })
          );
        }
        break;
      case 'entity_schema':
        navigate({ to: '/$workspaceSlug/settings/schemas', params: { workspaceSlug } });
        break;
      // workspace and content_node don't have dedicated detail views yet
    }
  };

  const getOperationLabel = (operation: string): string => {
    switch (operation) {
      case 'create':
        return 'created';
      case 'update':
        return 'updated';
      case 'delete':
        return 'deleted';
      default:
        return operation;
    }
  };

  const getEntityTypeLabel = (entityType: string): string => {
    switch (entityType) {
      case 'entity':
        return 'entity';
      case 'project':
        return 'project';
      case 'content_node':
        return 'diagram';
      case 'entity_schema':
        return 'schema';
      case 'workspace':
        return 'workspace';
      default:
        return entityType;
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          eyebrow="Home"
          title={workspace.name}
          description={workspace.description}
          buttons={
            <>
              {canCreateProjects && (
                <Button icon={<TbPlus size={12} />} onClick={openAddProjectDialog}>
                  New project
                </Button>
              )}
              {canCreateEntities && (
                <Button variant="primary" icon={<TbPlus size={12} />} onClick={openAddEntityDialog}>
                  New entity
                </Button>
              )}
            </>
          }
        />
      </div>

      <div className={styles.statGrid}>
        <StatCard
          label="Entities"
          value={totalEntities}
          sub={`${schemas.length} types`}
          icon={<TbDatabase size={14} />}
        />
        <StatCard
          label="Projects"
          value={projects.length}
          sub={`${totalFiles} diagrams`}
          icon={<TbFolders size={14} />}
        />
        <StatCard
          label="Diagrams"
          value={totalFiles}
          sub="across all projects"
          icon={<TbFileVector size={14} />}
        />
        <StatCard
          label="Entity types"
          value={schemas.length}
          sub="defined schemas"
          icon={<TbGitBranch size={14} />}
        />
        {facets && (
          <StatCard
            label="Well documented"
            value={facets.completeness.above80}
            sub={`${facets.completeness.below50} below 50% complete`}
            icon={<TbChartBar size={14} />}
            onClick={() =>
              navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug }, search: {} })
            }
          />
        )}
      </div>

      <div className={styles.homeGrid}>
        <Panel
          title="Projects"
          span2={showAllProjects}
          actions={
            hasMoreProjects ? (
              <button
                type="button"
                className={styles.link}
                onClick={() => setShowAllProjects(current => !current)}
              >
                {showAllProjects ? 'Collapse' : 'View all'} &rarr;
              </button>
            ) : undefined
          }
        >
          <div className={styles.projectList}>
            {visibleProjects.length > 0 ? (
              visibleProjects.map(p => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  expanded={showAllProjects}
                  onClick={() =>
                    navigate(
                      projectDetailRoute(workspaceSlug, asProjectPublicId(p.public_id), {
                        tab: 'projects' as const,
                        section: 'home' as const
                      })
                    )
                  }
                />
              ))
            ) : (
              <div className={`${styles.emptyInline} dim`}>No pinned or active projects.</div>
            )}
          </div>
        </Panel>

        {!showAllProjects && (
          <>
            {canViewSchemas && (
              <Panel title="Data model">
                <div className={styles.typecardList}>
                  {schemas.map((s, i) => (
                    <button
                      type="button"
                      key={s.id}
                      className={styles.typecard}
                      onClick={() =>
                        navigate({
                          to: '/$workspaceSlug/entities',
                          params: { workspaceSlug },
                          search: { type: s.id }
                        })
                      }
                    >
                      <span
                        className={styles.typecardBar}
                        style={{ background: resolveSchemaColor(s, i) }}
                      />
                      <span className={styles.typecardIcon}>
                        <TypeBadge
                          color={resolveSchemaColor(s, i)}
                          name={s.name}
                          icon={s.icon}
                          size={22}
                        />
                      </span>
                      <span className={styles.typecardBody}>
                        <div className={styles.typecardName}>{s.name}</div>
                        <div className={styles.typecardMeta}>
                          {s.fields.length} fields &middot; {s.entity_count} records
                        </div>
                      </span>
                      <TbChevronRight size={12} />
                    </button>
                  ))}

                </div>
              </Panel>
            )}

            {canViewAudit && (
              <Panel
                title="Recent activity"
                actions={
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() =>
                      navigate({
                        to: '/$workspaceSlug/settings/$section',
                        params: { workspaceSlug, section: 'audit' }
                      })
                    }
                  >
                    All activity &rarr;
                  </button>
                }
                span2
              >
                <div className={styles.activityList}>
                  {activityLoading ? (
                    <div className={`${styles.emptyInline} dim`}>Loading activity...</div>
                  ) : recentActivity.length > 0 ? (
                    recentActivity.slice(0, MAX_RECENT_ACTIVITY_ENTRIES).map(entry => (
                      <button
                        key={entry.id}
                        type="button"
                        className={styles.activityRow}
                        onClick={() => handleActivityClick(entry)}
                      >
                        <span className={styles.activityWho}>
                          {entry.user_display_name ?? entry.user_id ?? 'Unknown'}
                        </span>
                        <span className="dim"> {getOperationLabel(entry.operation)} </span>
                        <span className={styles.activityTarget}>{entry.entity_name}</span>
                        <span className="dim">
                          &middot; {getEntityTypeLabel(entry.entity_type)}
                        </span>
                        <span className={styles.activityTime}>
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className={`${styles.emptyInline} dim`}>No recent activity.</div>
                  )}
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  sub,
  icon,
  accent,
  onClick
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  accent?: boolean;
  onClick?: () => void;
}) => (
  <div
    className={`${styles.stat} ${accent ? styles.statAccent : ''} ${onClick ? styles.statClickable : ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={
      onClick
        ? e => {
            if (e.key === 'Enter' || e.key === ' ') onClick();
          }
        : undefined
    }
  >
    <div className={styles.statIcon}>{icon}</div>
    <div className={styles.statLabel}>{label}</div>
    <div className={`${styles.statValue} tabular`}>{value}</div>
    <div className={`${styles.statSub} dim`}>{sub}</div>
  </div>
);

const Panel = ({
  title,
  actions,
  children,
  span2
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  span2?: boolean;
}) => (
  <div className={`${styles.panel} ${span2 ? styles.panelSpan2 : ''}`}>
    <div className={styles.panelHeader}>
      <div className={styles.panelTitle}>{title}</div>
      {actions && <div className={styles.panelActions}>{actions}</div>}
    </div>
    <div className={styles.panelBody}>{children}</div>
  </div>
);

const ProjectRow = ({
  project,
  expanded,
  onClick
}: {
  project: Project;
  expanded: boolean;
  onClick: () => void;
}) => (
  <button type="button" className={styles.projectRow} onClick={onClick}>
    {project.color && (
      <span
        className={styles.projectColorBar}
        style={{ background: project.color }}
        aria-hidden="true"
      />
    )}
    <div className={styles.projectRowL}>
      <TbFolders size={14} style={project.color ? { color: project.color } : undefined} />
      <span className={styles.projectName}>{project.name}</span>
    </div>
    <div className={styles.projectRowR}>
      {expanded && <Chip tone="ghost">{PROJECT_STATUS_META[project.status].label}</Chip>}
      <span className="dim">{project.file_count} diagrams</span>
    </div>
  </button>
);
