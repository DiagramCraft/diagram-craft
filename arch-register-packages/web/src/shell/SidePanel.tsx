import { Fragment } from 'react';
import styles from './SidePanel.module.css';
import { TreeRow } from '../components/TreeRow';
import { TypeBadge } from '../components/TypeBadge';
import {
  TbStack2, TbDatabase, TbPlus, TbFilter, TbStar,
  TbChartDots3, TbFolderOpen, TbCode, TbTag, TbUsers,
} from 'react-icons/tb';
import {
  PROJECTS, ENTITY_TYPES, ENTITIES, TEAMS, STATUS_TONE,
} from '../data';
import type { ViewId, NavigateFn } from '../routing';

type SidePanelProps = {
  view: ViewId;
  navigate: NavigateFn;
  projectId: string | null;
  typeFilter: string | null;
  setTypeFilter: (id: string | null) => void;
  expanded: Record<string, boolean>;
  setExpanded: (e: Record<string, boolean>) => void;
};

export const SidePanel = ({
  view,
  navigate,
  projectId,
  typeFilter,
  setTypeFilter,
  expanded,
  setExpanded,
}: SidePanelProps) => {
  let body: React.ReactNode;

  if (view === 'home') {
    body = <HomeSidebar navigate={navigate} />;
  } else if (view === 'project-detail') {
    body = (
      <ProjectsSidebar
        projectId={projectId}
        navigate={navigate}
        expanded={expanded}
        setExpanded={setExpanded}
      />
    );
  } else if (view === 'entity-browser' || view === 'entity-detail') {
    body = <EntitiesSidebar typeFilter={typeFilter} setTypeFilter={setTypeFilter} />;
  } else if (view === 'data-model') {
    body = <DataModelSidebar />;
  } else if (view === 'search') {
    body = <SearchSidebar />;
  }

  return <div className={styles.panel}>{body}</div>;
};

const SectionHeader = ({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) => (
  <div className={styles.header}>
    <div className={styles.headerTitle}>{title}</div>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </div>
);

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);

const HomeSidebar = ({ navigate }: { navigate: NavigateFn }) => (
  <>
    <SectionHeader title="Overview" />
    <div className={styles.scroll}>
      <GroupLabel>Pinned projects</GroupLabel>
      {PROJECTS.filter(p => p.starred).map(p => (
        <TreeRow
          key={p.id}
          icon={<TbStack2 size={12} />}
          label={p.name}
          onClick={() => navigate({ view: 'project-detail', projectId: p.id })}
          trailing={<span className="dim mono">{p.diagrams}</span>}
        />
      ))}
      <GroupLabel>All projects</GroupLabel>
      {PROJECTS.filter(p => !p.starred).map(p => (
        <TreeRow
          key={p.id}
          icon={<TbStack2 size={12} />}
          label={p.name}
          onClick={() => navigate({ view: 'project-detail', projectId: p.id })}
          trailing={<span className="dim mono">{p.diagrams}</span>}
        />
      ))}
      <GroupLabel>Data model</GroupLabel>
      {ENTITY_TYPES.map(t => (
        <TreeRow
          key={t.id}
          icon={<TypeBadge typeId={t.id} size={14} />}
          label={t.plural}
          onClick={() => navigate({ view: 'entity-browser', typeFilter: t.id })}
          trailing={<span className="dim mono">{t.count}</span>}
          tagColor={t.color}
        />
      ))}
    </div>
  </>
);

const ProjectsSidebar = ({
  projectId,
  navigate,
  expanded,
  setExpanded,
}: {
  projectId: string | null;
  navigate: NavigateFn;
  expanded: Record<string, boolean>;
  setExpanded: (e: Record<string, boolean>) => void;
}) => (
  <>
    <SectionHeader
      title="Projects"
      actions={
        <button type="button" className={styles.action}>
          <TbPlus size={12} />
        </button>
      }
    />
    <div className={styles.scroll}>
      {PROJECTS.map(p => {
        const isOpen = expanded[p.id] ?? p.id === projectId;
        return (
          <Fragment key={p.id}>
            <TreeRow
              expandable
              expanded={isOpen}
              onExpand={() => setExpanded({ ...expanded, [p.id]: !isOpen })}
              icon={<TbStack2 size={12} />}
              label={p.name}
              active={p.id === projectId}
              onClick={() => navigate({ view: 'project-detail', projectId: p.id })}
              trailing={p.starred ? <TbStar size={10} /> : undefined}
            />
            {isOpen && (
              <>
                {p.rootItems.map(i => (
                  <TreeRow
                    key={i.id}
                    depth={1}
                    icon={<TbChartDots3 size={12} />}
                    label={i.name}
                    onClick={() =>
                      navigate({ view: 'diagram', diagramId: i.id, projectId: p.id })
                    }
                    trailing={i.pinned ? <TbStar size={10} /> : undefined}
                  />
                ))}
                {p.folders.map(f => (
                  <Fragment key={f.id}>
                    <TreeRow
                      depth={1}
                      expandable
                      expanded
                      icon={<TbFolderOpen size={12} />}
                      label={f.name}
                    />
                    {f.items.map(i => (
                      <TreeRow
                        key={i.id}
                        depth={2}
                        icon={<TbChartDots3 size={12} />}
                        label={i.name}
                        onClick={() =>
                          navigate({ view: 'diagram', diagramId: i.id, projectId: p.id })
                        }
                      />
                    ))}
                  </Fragment>
                ))}
              </>
            )}
          </Fragment>
        );
      })}
    </div>
  </>
);

const EntitiesSidebar = ({
  typeFilter,
  setTypeFilter,
}: {
  typeFilter: string | null;
  setTypeFilter: (id: string | null) => void;
}) => (
  <>
    <SectionHeader
      title="Types"
      actions={
        <button type="button" className={styles.action}>
          <TbFilter size={12} />
        </button>
      }
    />
    <div className={styles.scroll}>
      <TreeRow
        icon={<TbDatabase size={12} />}
        label="All entities"
        active={!typeFilter}
        onClick={() => setTypeFilter(null)}
        trailing={<span className="dim mono">{ENTITIES.length}</span>}
      />
      <GroupLabel>By type</GroupLabel>
      {ENTITY_TYPES.map(t => {
        const n = ENTITIES.filter(e => e.type === t.id).length;
        return (
          <TreeRow
            key={t.id}
            icon={<TypeBadge typeId={t.id} size={14} />}
            label={t.plural}
            active={typeFilter === t.id}
            onClick={() => setTypeFilter(t.id)}
            trailing={<span className="dim mono">{n}</span>}
            tagColor={t.color}
          />
        );
      })}
      <GroupLabel>By status</GroupLabel>
      {['Active', 'Proposed', 'Deprecated'].map(s => (
        <TreeRow
          key={s}
          icon={
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: STATUS_TONE[s]!.dot,
              }}
            />
          }
          label={s}
          trailing={
            <span className="dim mono">
              {ENTITIES.filter(e => e.status === s).length}
            </span>
          }
        />
      ))}
      <GroupLabel>By owner</GroupLabel>
      {TEAMS.slice(0, 6).map(team => {
        const n = ENTITIES.filter(e => e.owner === team).length;
        if (!n) return null;
        return (
          <TreeRow
            key={team}
            icon={<TbUsers size={12} />}
            label={team}
            trailing={<span className="dim mono">{n}</span>}
          />
        );
      })}
    </div>
  </>
);

const DataModelSidebar = () => (
  <>
    <SectionHeader
      title="Types"
      actions={
        <button type="button" className={styles.action}>
          <TbPlus size={12} />
        </button>
      }
    />
    <div className={styles.scroll}>
      <GroupLabel>Entity types</GroupLabel>
      {ENTITY_TYPES.map(t => (
        <TreeRow
          key={t.id}
          icon={<TypeBadge typeId={t.id} size={14} />}
          label={t.name}
          tagColor={t.color}
          trailing={<span className="dim mono">{t.fields.length}f</span>}
        />
      ))}
      <GroupLabel>Reference types</GroupLabel>
      <TreeRow icon={<TbUsers size={12} />} label="Team" trailing={<span className="dim mono">3f</span>} />
      <TreeRow icon={<TbTag size={12} />} label="Tag" trailing={<span className="dim mono">1f</span>} />
      <GroupLabel>Enums</GroupLabel>
      <TreeRow icon={<TbCode size={12} />} label="Lifecycle" trailing={<span className="dim mono">4</span>} />
      <TreeRow icon={<TbCode size={12} />} label="Tier" trailing={<span className="dim mono">4</span>} />
      <TreeRow icon={<TbCode size={12} />} label="Protocol" trailing={<span className="dim mono">5</span>} />
      <TreeRow icon={<TbCode size={12} />} label="SLA" trailing={<span className="dim mono">4</span>} />
    </div>
  </>
);

const SearchSidebar = () => (
  <>
    <SectionHeader title="Search" />
    <div className={styles.scroll} style={{ padding: 8 }}>
      <div className="dim">Type in the top bar to search.</div>
    </div>
  </>
);
