import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { TbPencil, TbTrash } from 'react-icons/tb';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import type { SavedView } from '@arch-register/api-types/viewContract';
import { SidebarGroupLabel } from '../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../components/TreeRow';
import { useDeleteSavedView, useSavedViews, useUpdateSavedView } from '../../hooks/useSavedViews';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { savedViewIcon } from '../../lib/savedViewIcon';
import { asProjectPublicId, projectDetailRoute } from '../../routes/publicObjectRoutes';
import type { ProjectSearchParams } from '../../routes/searchParams';
import styles from '../../shell/SidePanel.module.css';
import { EditViewDialog } from '../entities/components/EntityBrowser';
import { toSavedViewSearch } from '../entities/components/entityBrowserState';

// The "Views" tab of the project sidebar: pinned (admin) and personal saved views of the project's
// entities, with rename and delete.
export const ProjectViewsPanel = ({
  workspaceSlug,
  projectId,
  canEdit
}: {
  workspaceSlug: string;
  projectId: string;
  canEdit: boolean;
}) => {
  const { permissions } = useWorkspaceContext();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ProjectSearchParams;
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, { projectId });
  const projectViews = savedViews.filter(view => view.scope === 'project');
  const deleteView = useDeleteSavedView(workspaceSlug);
  const updateView = useUpdateSavedView(workspaceSlug);
  const [viewMenu, setViewMenu] = useState<{ x: number; y: number; view: SavedView } | null>(null);
  const [renameView, setRenameView] = useState<SavedView | null>(null);
  const [deleteViewTarget, setDeleteViewTarget] = useState<SavedView | null>(null);

  const applyView = (view: SavedView) =>
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
        tab: search.tab,
        section: 'entities',
        contentQuery: search.contentQuery,
        contentView: search.contentView,
        ...toSavedViewSearch(view)
      })
    );

  const renderViews = (admin: boolean, label: string) => {
    const views = projectViews.filter(view => view.isAdminView === admin);
    return views.length ? (
      <>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        {views.map(view => (
          <TreeRow
            key={view.id}
            icon={savedViewIcon(view.viewMode)}
            label={view.name}
            active={search.viewId === view.id}
            onClick={() => applyView(view)}
            onContextMenu={event => {
              if (admin ? !permissions.canManageAdminViews : !canEdit) return;
              event.preventDefault();
              event.stopPropagation();
              setViewMenu({ x: event.clientX, y: event.clientY, view });
            }}
          />
        ))}
      </>
    ) : null;
  };

  return (
    <>
      {renderViews(true, 'Pinned views')}
      {renderViews(false, 'Views')}
      {!projectViews.length && (
        <div className={`${styles.emptyState} dim`}>No saved views yet.</div>
      )}

      {viewMenu && (
        <ContextMenu.Imperative x={viewMenu.x} y={viewMenu.y} onClose={() => setViewMenu(null)}>
          <Menu.Item leftSlot={<TbPencil size={13} />} onClick={() => setRenameView(viewMenu.view)}>
            Rename
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            onClick={() => setDeleteViewTarget(viewMenu.view)}
          >
            Delete
          </Menu.Item>
        </ContextMenu.Imperative>
      )}
      {renameView && (
        <EditViewDialog
          open
          currentName={renameView.name}
          currentDescription={renameView.description}
          onSave={(name, description) => {
            updateView.mutate({ id: renameView.id, body: { name, description } });
            setRenameView(null);
          }}
          onCancel={() => setRenameView(null)}
        />
      )}
      <DeleteConfirmationDialog
        open={!!deleteViewTarget}
        title="Delete view?"
        message={
          <>
            The view <b>{deleteViewTarget?.name}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete view"
        onConfirm={() => {
          if (deleteViewTarget) deleteView.mutate(deleteViewTarget.id);
          setDeleteViewTarget(null);
        }}
        onCancel={() => setDeleteViewTarget(null)}
      />
    </>
  );
};
