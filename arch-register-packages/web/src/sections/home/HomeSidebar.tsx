import { useNavigate } from '@tanstack/react-router';
import { TbFolders } from 'react-icons/tb';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { resolveSchemaColor } from '../../lib/api';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { Project } from '@arch-register/api-types/projectContract';
import { EntitySchema } from '@arch-register/api-types/schemaContract';

const getSidebarProjectGroups = (projects: Project[]) => {
  const pinned = projects.filter(p => p.pinned);
  const active = projects.filter(p => !p.pinned && (p.status === 'draft' || p.status === 'active'));
  return [
    ...(pinned.length > 0 ? [{ title: 'Pinned Projects', projects: pinned }] : []),
    ...(active.length > 0 ? [{ title: 'Active Projects', projects: active }] : [])
  ];
};



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
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root value="overview">
          <Tabs.List>
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>
      <div className={styles.scroll}>
        {getSidebarProjectGroups(projects).map(group => (
          <div key={group.title}>
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
                    search: { tab: 'projects' as const, section: 'home' as const }
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
