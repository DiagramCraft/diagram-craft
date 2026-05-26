import { useState } from 'react';
import styles from './WorkspaceHome.module.css';
import { Chip } from '../components/Chip';
import { TypeBadge } from '../components/TypeBadge';
import {
  TbDatabase, TbStack2, TbChartDots3, TbGitBranch,
  TbPlus, TbChevronRight,
} from 'react-icons/tb';
import {
  RECENT_ACTIVITY,
  type Workspace,
} from '../data';
import type { NavigateFn } from '../routing';
import { resolveSchemaColor } from '../api';
import type { EntitySchema, Project } from '../api';

const PROJECT_STATUS_META = {
  pinned: { label: 'Pinned' },
  active: { label: 'Active' },
  archived: { label: 'Archived' },
} as const;

type WorkspaceHomeProps = {
  workspace: Workspace;
  schemas: EntitySchema[];
  projects: Project[];
  navigate: NavigateFn;
  onAddProject: () => void;
  onAddEntity: () => void;
};

export const WorkspaceHome = ({
  workspace,
  schemas,
  projects,
  navigate,
  onAddProject,
  onAddEntity,
}: WorkspaceHomeProps) => {
  const collapsedProjectCount = 6;
  const [showAllProjects, setShowAllProjects] = useState(false);
  const totalEntities = schemas.reduce((sum, s) => sum + s.entity_count, 0);
  const totalFiles = projects.reduce((sum, p) => sum + p.file_count, 0);
  const nonArchivedProjects = projects.filter(p => p.status !== 'archived');
  const hasMoreProjects = nonArchivedProjects.length > collapsedProjectCount;
  const visibleProjects = showAllProjects
    ? projects
    : nonArchivedProjects.slice(0, collapsedProjectCount);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Workspace</div>
          <div className={styles.title}>{workspace.name}</div>
          <div className={styles.sub}>{workspace.description}</div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onAddProject}>
            <TbPlus size={12} /> New project
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onAddEntity}
          >
            <TbPlus size={12} /> New entity
          </button>
        </div>
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
          icon={<TbStack2 size={14} />}
        />
        <StatCard
          label="Diagrams"
          value={totalFiles}
          sub="across all projects"
          icon={<TbChartDots3 size={14} />}
        />
        <StatCard
          label="Entity types"
          value={schemas.length}
          sub="defined schemas"
          icon={<TbGitBranch size={14} />}
        />
      </div>

      <div className={styles.homeGrid}>
        <Panel
          title="Projects"
          span2={showAllProjects}
          actions={hasMoreProjects ? (
            <button
              type="button"
              className={styles.link}
              onClick={() => setShowAllProjects(current => !current)}
            >
              {showAllProjects ? 'Collapse' : 'View all'} &rarr;
            </button>
          ) : undefined}
        >
          <div className={styles.projectList}>
            {visibleProjects.length > 0 ? (
              visibleProjects.map(p => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  expanded={showAllProjects}
                  onClick={() => navigate({ view: 'project-detail', projectId: p.id, projectSidebarTab: 'projects' })}
                />
              ))
            ) : (
              <div className={`${styles.emptyInline} dim`}>
                No pinned or active projects.
              </div>
            )}
          </div>
        </Panel>

        {!showAllProjects && (
          <>
            <Panel title="Data model">
              <div className={styles.typecardList}>
                {schemas.map((s, i) => (
                  <button
                    type="button"
                    key={s.id}
                    className={styles.typecard}
                    onClick={() => navigate({ view: 'entity-browser', typeFilter: s.id })}
                  >
                    <span className={styles.typecardBar} style={{ background: resolveSchemaColor(s, i) }} />
                    <span className={styles.typecardIcon}>
                      <TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={22} />
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
                <button
                  type="button"
                  className={`${styles.typecard} ${styles.typecardAdd}`}
                  onClick={() => navigate({ view: 'data-model' })}
                >
                  <span className={styles.typecardIcon}>
                    <TbPlus size={14} />
                  </span>
                  <span className={styles.typecardBody}>
                    <div className={styles.typecardName}>Add entity type</div>
                    <div className={styles.typecardMeta}>Define a new schema</div>
                  </span>
                </button>
              </div>
            </Panel>

            <Panel
              title="Recent activity"
              actions={<button type="button" className={styles.link}>All activity &rarr;</button>}
              span2
            >
              <div className={styles.activityList}>
                {RECENT_ACTIVITY.map((a, i) => (
                  <div key={i} className={styles.activityRow}>
                    <span className={styles.activityWho}>{a.who}</span>
                    <span className="dim"> {a.what} </span>
                    <span className={styles.activityTarget}>{a.target}</span>
                    <span className="dim">&middot; {a.project}</span>
                    <span className={styles.activityTime}>{a.time}</span>
                  </div>
                ))}
              </div>
            </Panel>
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
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  accent?: boolean;
}) => (
  <div className={`${styles.stat} ${accent ? styles.statAccent : ''}`}>
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
  span2,
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
  onClick,
}: {
  project: Project;
  expanded: boolean;
  onClick: () => void;
}) => (
  <button type="button" className={styles.projectRow} onClick={onClick}>
    <div className={styles.projectRowL}>
      <TbStack2 size={14} />
      <span className={styles.projectName}>{project.name}</span>
    </div>
    <div className={styles.projectRowR}>
      {expanded && (
        <Chip tone="ghost">
          {PROJECT_STATUS_META[project.status].label}
        </Chip>
      )}
      <span className="dim">{project.file_count} diagrams</span>
    </div>
  </button>
);
