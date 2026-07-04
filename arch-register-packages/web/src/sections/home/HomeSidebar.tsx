import { useNavigate } from '@tanstack/react-router';
import { TbFolders } from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { Project } from '@arch-register/api-types/projectContract';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { asProjectPublicId, projectDetailRoute } from '../../routes/publicObjectRoutes';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../components/sidebar/SidebarPrimitives';

const getSidebarProjectGroups = (projects: Project[]) => {
  const pinned = projects.filter(p => p.pinned);
  const active = projects.filter(p => !p.pinned && (p.status === 'draft' || p.status === 'active'));
  return [
    ...(pinned.length > 0 ? [{ title: 'Pinned Projects', projects: pinned }] : []),
    ...(active.length > 0 ? [{ title: 'Active Projects', projects: active }] : [])
  ];
};
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
      <SidebarTitleHeader title="Overview" />
      <div className={styles.scroll}>
        {getSidebarProjectGroups(projects).map(group => (
          <div key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            {group.projects.map(p => (
              <TreeRow
                key={p.id}
                icon={<TbFolders size={12} style={p.color ? { color: p.color } : undefined} />}
                label={p.name}
                onClick={() =>
                  navigate(
                    projectDetailRoute(workspaceSlug, asProjectPublicId(p.public_id), {
                      tab: 'projects' as const,
                      section: 'home' as const
                    })
                  )
                }
                trailing={<span className="dim mono">{p.file_count}</span>}
                tagColor={p.color ?? undefined}
              />
            ))}
          </div>
        ))}
        <SidebarGroupLabel>Data model</SidebarGroupLabel>
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
