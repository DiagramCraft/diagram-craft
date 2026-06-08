import { useNavigate } from '@tanstack/react-router';
import { TbFolders } from 'react-icons/tb';
import { resolveSchemaColor } from '../../api';
import type { EntitySchema, Project } from '../../api';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';

const PROJECT_GROUPS = [
  { status: 'pinned', title: 'Pinned Projects' },
  { status: 'active', title: 'Active Projects' }
] as const;

const getSidebarProjectGroups = (projects: Project[]) =>
  PROJECT_GROUPS.map(group => ({
    ...group,
    projects: projects.filter(project => project.status === group.status)
  })).filter(group => group.projects.length > 0);

const SectionHeader = ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
  <div className={`${styles.header} ${styles.tabHeader}`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
    </div>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </div>
);

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);

export const HomeSidebar = ({
  schemas,
  projects,
  workspaceSlug
}: {
  schemas: EntitySchema[];
  projects: Project[];
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  return (
    <>
      <SectionHeader title="Overview" />
      <div className={styles.scroll}>
        {getSidebarProjectGroups(projects).map(group => (
          <div key={group.status}>
            <GroupLabel>{group.title}</GroupLabel>
            {group.projects.map(p => (
              <TreeRow
                key={p.id}
                icon={<TbFolders size={12} style={p.color ? { color: p.color } : undefined} />}
                label={p.name}
                onClick={() =>
                  navigate({
                    to: '/$workspaceSlug/projects/$projectId',
                    params: { workspaceSlug, projectId: p.id },
                    search: {
                      tab: p.status === 'archived' ? ('archive' as const) : ('projects' as const)
                    }
                  })
                }
                trailing={<span className="dim mono">{p.file_count}</span>}
                tagColor={p.color ?? undefined}
              />
            ))}
          </div>
        ))}
        <GroupLabel>Data model</GroupLabel>
        {schemas.map((s, i) => (
          <TreeRow
            key={s.id}
            icon={
              <TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />
            }
            label={s.name}
            onClick={() =>
              navigate({
                to: '/$workspaceSlug/entities',
                params: { workspaceSlug },
                search: { type: s.id }
              })
            }
            trailing={<span className="dim mono">{s.entity_count}</span>}
            tagColor={resolveSchemaColor(s, i)}
          />
        ))}
      </div>
    </>
  );
};
