import styles from './WorkspaceHome.module.css';
import { TypeBadge } from '../components/TypeBadge';
import { StatusChip } from '../components/StatusChip';
import {
  TbDatabase, TbStack2, TbChartDots3, TbGitBranch,
  TbPlus, TbChevronRight, TbStar,
} from 'react-icons/tb';
import {
  PROJECTS, ENTITY_TYPES, ENTITIES, RECENT_ACTIVITY,
  type Workspace, type Project,
} from '../data';
import type { NavigateFn } from '../routing';

type WorkspaceHomeProps = {
  workspace: Workspace;
  navigate: NavigateFn;
};

export const WorkspaceHome = ({ workspace, navigate }: WorkspaceHomeProps) => {
  const totalEntities = ENTITIES.length;
  const active = ENTITIES.filter(e => e.status === 'Active').length;
  const deprecated = ENTITIES.filter(e => e.status === 'Deprecated').length;
  const proposed = ENTITIES.filter(e => e.status === 'Proposed').length;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Workspace</div>
          <div className={styles.title}>{workspace.name}</div>
          <div className={styles.sub}>{workspace.description}</div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn}>
            <TbPlus size={12} /> New project
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
            <TbPlus size={12} /> New entity
          </button>
        </div>
      </div>

      <div className={styles.statGrid}>
        <StatCard
          label="Entities"
          value={totalEntities}
          sub={`${active} active \u00b7 ${deprecated} deprecated`}
          icon={<TbDatabase size={14} />}
        />
        <StatCard
          label="Projects"
          value={PROJECTS.length}
          sub={`${PROJECTS.filter(p => p.status === 'Active').length} in flight`}
          icon={<TbStack2 size={14} />}
        />
        <StatCard
          label="Diagrams"
          value={PROJECTS.reduce((n, p) => n + p.diagrams, 0)}
          sub="across all projects"
          icon={<TbChartDots3 size={14} />}
        />
        <StatCard
          label="Pending changes"
          value={proposed}
          sub="proposed entities"
          icon={<TbGitBranch size={14} />}
          accent
        />
      </div>

      <div className={styles.homeGrid}>
        <Panel
          title="Projects"
          actions={<button type="button" className={styles.link}>View all &rarr;</button>}
        >
          <div className={styles.projectList}>
            {PROJECTS.map(p => (
              <ProjectRow
                key={p.id}
                project={p}
                onClick={() => navigate({ view: 'project-detail', projectId: p.id })}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Data model">
          <div className={styles.typecardList}>
            {ENTITY_TYPES.map(t => (
              <button
                type="button"
                key={t.id}
                className={styles.typecard}
                onClick={() => navigate({ view: 'entity-browser', typeFilter: t.id })}
              >
                <span className={styles.typecardBar} style={{ background: t.color }} />
                <span className={styles.typecardIcon}>
                  <TypeBadge typeId={t.id} size={22} />
                </span>
                <span className={styles.typecardBody}>
                  <div className={styles.typecardName}>{t.plural}</div>
                  <div className={styles.typecardMeta}>
                    {t.fields.length} fields &middot; {t.count} records
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
  onClick,
}: {
  project: Project;
  onClick: () => void;
}) => (
  <button type="button" className={styles.projectRow} onClick={onClick}>
    <div className={styles.projectRowL}>
      <TbStack2 size={14} />
      <span className={styles.projectName}>{project.name}</span>
      {project.starred && (
        <TbStar size={11} style={{ color: 'var(--warn)' }} />
      )}
    </div>
    <div className={styles.projectRowC}>
      <div className={styles.progress}>
        <div
          className={styles.progressBar}
          style={{ width: `${project.progress}%` }}
        />
      </div>
      <span className="dim mono tabular" style={{ width: 34, textAlign: 'right' }}>
        {project.progress}%
      </span>
    </div>
    <div className={styles.projectRowR}>
      <span className="dim">{project.diagrams} diagrams</span>
      <StatusChip value={project.status} />
      <span className="dim" style={{ width: 90, textAlign: 'right' }}>
        {project.updated}
      </span>
    </div>
  </button>
);
