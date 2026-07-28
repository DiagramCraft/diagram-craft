import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  TbDatabase,
  TbFolders,
  TbLayoutDashboard,
  TbPencil,
  TbPlus,
  TbTrash
} from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { Project } from '@arch-register/api-types/projectContract';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { asProjectPublicId, projectDetailRoute } from '../../routes/publicObjectRoutes';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useCreateWorkspaceDashboard,
  useDeleteWorkspaceDashboard,
  useUpdateWorkspaceDashboard,
  useWorkspaceDashboards
} from '../../hooks/useDashboard';
import { DashboardNameDialog } from '../dashboard/DashboardNameDialog';

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
  const search = useSearch({ strict: false }) as { dashboard?: string };
  const { permissions, openAddProjectDialog, openAddEntityDialog } = useWorkspaceContext();
  const { canManageDashboard, canCreateProjects, canCreateEntities } = permissions;

  const { data: dashboards } = useWorkspaceDashboards(workspaceSlug);
  const createDashboard = useCreateWorkspaceDashboard(workspaceSlug);
  const updateDashboard = useUpdateWorkspaceDashboard(workspaceSlug);
  const deleteDashboard = useDeleteWorkspaceDashboard(workspaceSlug);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    dashboardId: string;
  } | null>(null);

  const activeDashboardId = search.dashboard ?? dashboards?.[0]?.id;
  const contextMenuDashboard = dashboards?.find(d => d.id === contextMenu?.dashboardId) ?? null;
  const canDeleteDashboard = (dashboards?.length ?? 0) > 1;

  const selectDashboard = (id: string) => {
    navigate({
      to: '/$workspaceSlug',
      params: { workspaceSlug },
      search: prev => ({ ...prev, dashboard: id })
    });
  };

  return (
    <>
      <SidebarTitleHeader
        title="Overview"
        actions={
          (canManageDashboard || canCreateProjects || canCreateEntities) && (
            <MenuButton.Root>
              <MenuButton.Trigger
                element={
                  <button type="button" className={styles.action} title="New">
                    <TbPlus size={13} />
                  </button>
                }
              />
              <MenuButton.Menu>
                {canManageDashboard && (
                  <Menu.Item
                    leftSlot={<TbLayoutDashboard size={13} />}
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    New dashboard
                  </Menu.Item>
                )}
                {canManageDashboard && (canCreateProjects || canCreateEntities) && (
                  <Menu.Separator />
                )}
                {canCreateProjects && (
                  <Menu.Item leftSlot={<TbFolders size={13} />} onClick={openAddProjectDialog}>
                    New project
                  </Menu.Item>
                )}
                {canCreateEntities && (
                  <Menu.Item leftSlot={<TbDatabase size={13} />} onClick={openAddEntityDialog}>
                    New entity
                  </Menu.Item>
                )}
              </MenuButton.Menu>
            </MenuButton.Root>
          )
        }
      />
      <div className={styles.scroll}>
        {dashboards && dashboards.length > 0 && (
          <div>
            <SidebarGroupLabel>Dashboards</SidebarGroupLabel>
            {dashboards.map(dashboard => (
              <TreeRow
                key={dashboard.id}
                testId={`dashboard-row-${dashboard.name}`}
                icon={<TbLayoutDashboard size={12} />}
                label={dashboard.name}
                active={dashboard.id === activeDashboardId}
                onClick={() => selectDashboard(dashboard.id)}
                onContextMenu={
                  canManageDashboard
                    ? event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setContextMenu({
                          x: event.clientX,
                          y: event.clientY,
                          dashboardId: dashboard.id
                        });
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
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

      {contextMenu && (
        <ContextMenu.Imperative
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <Menu.Item
            leftSlot={<TbPencil size={13} />}
            disabled={!contextMenuDashboard}
            onClick={() => {
              if (contextMenuDashboard) setRenameTarget(contextMenuDashboard);
              setContextMenu(null);
            }}
          >
            Rename
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            disabled={!contextMenuDashboard || !canDeleteDashboard}
            onClick={() => {
              if (contextMenuDashboard) setDeleteTarget(contextMenuDashboard);
              setContextMenu(null);
            }}
          >
            Delete
          </Menu.Item>
        </ContextMenu.Imperative>
      )}

      <DashboardNameDialog
        key={`create-${createDialogOpen}`}
        open={createDialogOpen}
        title="New dashboard"
        confirmLabel="Create dashboard"
        onCancel={() => setCreateDialogOpen(false)}
        onConfirm={name => {
          createDashboard.mutate(
            { name },
            {
              onSuccess: created => {
                setCreateDialogOpen(false);
                selectDashboard(created.id);
              }
            }
          );
        }}
      />

      {renameTarget && (
        <DashboardNameDialog
          key={`rename-${renameTarget.id}`}
          open={!!renameTarget}
          title="Rename dashboard"
          confirmLabel="Save"
          initialName={renameTarget.name}
          onCancel={() => setRenameTarget(null)}
          onConfirm={name => {
            updateDashboard.mutate(
              { id: renameTarget.id, body: { name } },
              { onSuccess: () => setRenameTarget(null) }
            );
          }}
        />
      )}

      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title="Delete dashboard?"
        message={
          deleteTarget ? (
            <>
              The dashboard <b>{deleteTarget.name}</b> will be permanently deleted.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete dashboard"
        onConfirm={() => {
          if (!deleteTarget) return;
          const wasActive = deleteTarget.id === activeDashboardId;
          deleteDashboard.mutate(deleteTarget.id, {
            onSuccess: () => {
              if (wasActive) {
                navigate({
                  to: '/$workspaceSlug',
                  params: { workspaceSlug },
                  search: prev => ({ ...prev, dashboard: undefined })
                });
              }
            }
          });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};
