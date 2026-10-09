import { useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbArrowDown, TbArrowUp, TbPencil, TbPlus, TbSettings, TbTrash } from 'react-icons/tb';
import type { NavRailAction } from '@diagram-craft/app-components/NavRail';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { WorkspaceApplicationWithDashboards } from '@arch-register/api-types/applicationContract';
import { DashboardNameDialog } from '../sections/dashboard/DashboardNameDialog';
import {
  useCreateWorkspaceDashboard,
  useDeleteWorkspaceDashboard,
  useUpdateWorkspaceDashboard
} from '../hooks/useDashboard';
import {
  useDeleteApplication,
  useReorderApplicationDashboards,
  useUpdateApplication
} from '../hooks/useApplications';

type DashboardRef = WorkspaceApplicationWithDashboards['dashboards'][number];

const ApplicationDialog = ({
  application,
  onCancel,
  onConfirm
}: {
  application: WorkspaceApplicationWithDashboards;
  onCancel: () => void;
  onConfirm: (body: { name: string; description: string; accentColor: string | null }) => void;
}) => {
  const [name, setName] = useState(application.name);
  const [description, setDescription] = useState(application.description);
  const [accentColor, setAccentColor] = useState(application.accentColor ?? '');
  return (
    <Dialog
      open
      onClose={onCancel}
      title="Edit application"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: 'Save',
          type: 'default',
          disabled: !name.trim(),
          onClick: () =>
            onConfirm({
              name: name.trim(),
              description: description.trim(),
              accentColor: accentColor.trim() || null
            })
        }
      ]}
    >
      <FormElement label="Name" required>
        <TextInput value={name} onChange={value => setName(value ?? '')} autoFocus />
      </FormElement>
      <FormElement label="Description">
        <TextInput value={description} onChange={value => setDescription(value ?? '')} />
      </FormElement>
      <FormElement label="Accent color">
        <TextInput
          value={accentColor}
          onChange={value => setAccentColor(value ?? '')}
          placeholder="Any CSS color, e.g. #3b82f6"
        />
      </FormElement>
    </Dialog>
  );
};

/**
 * Add / rename / re-icon / reorder / delete dashboards of an application, plus edit or delete the
 * application itself, driven from the left rail. Spread `railProps` onto the `NavRail` and render
 * `overlays` anywhere in the tree.
 */
export const useApplicationDashboardManager = (
  workspaceSlug: string,
  application: WorkspaceApplicationWithDashboards | undefined,
  enabled: boolean
): {
  railProps: {
    onItemContextMenu?: (id: string, event: React.MouseEvent) => void;
    actions?: NavRailAction[];
  };
  overlays: ReactNode;
} => {
  const navigate = useNavigate();
  const createDashboard = useCreateWorkspaceDashboard(workspaceSlug);
  const updateDashboard = useUpdateWorkspaceDashboard(workspaceSlug);
  const deleteDashboard = useDeleteWorkspaceDashboard(workspaceSlug);
  const updateApplication = useUpdateApplication(workspaceSlug);
  const deleteApplication = useDeleteApplication(workspaceSlug);
  const reorder = useReorderApplicationDashboards(workspaceSlug);

  const [createOpen, setCreateOpen] = useState(false);
  const [editApplicationOpen, setEditApplicationOpen] = useState(false);
  const [deleteApplicationOpen, setDeleteApplicationOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DashboardRef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardRef | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; dashboardId: string } | null>(null);

  if (!enabled || !application) return { railProps: {}, overlays: null };

  const dashboards = [...application.dashboards].sort((a, b) => a.order - b.order);
  const menuIndex = dashboards.findIndex(d => d.id === menu?.dashboardId);
  const menuDashboard = menuIndex >= 0 ? dashboards[menuIndex] : null;

  const goToDashboard = (dashboardId: string) =>
    navigate({
      to: '/$workspaceSlug/apps/$appKey/$dashboardId',
      params: { workspaceSlug, appKey: application.key, dashboardId }
    });

  const move = (index: number, delta: -1 | 1) => {
    const ids = dashboards.map(d => d.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate({ applicationId: application.id, ids });
  };

  const railProps = {
    onItemContextMenu: (id: string, event: React.MouseEvent) =>
      setMenu({ x: event.clientX, y: event.clientY, dashboardId: id }),
    actions: [
      {
        id: 'add-dashboard',
        icon: TbPlus,
        tooltip: 'Add dashboard',
        onClick: () => setCreateOpen(true)
      },
      {
        id: 'edit-application',
        icon: TbSettings,
        tooltip: 'Edit application',
        onClick: () => setEditApplicationOpen(true)
      }
    ]
  };

  const overlays = (
    <>
      {menu && (
        <ContextMenu.Imperative x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          <Menu.Item
            leftSlot={<TbPencil size={13} />}
            disabled={!menuDashboard}
            onClick={() => {
              if (menuDashboard) setEditTarget(menuDashboard);
              setMenu(null);
            }}
          >
            Rename / change icon
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbArrowUp size={13} />}
            disabled={menuIndex <= 0}
            onClick={() => {
              move(menuIndex, -1);
              setMenu(null);
            }}
          >
            Move up
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbArrowDown size={13} />}
            disabled={menuIndex < 0 || menuIndex >= dashboards.length - 1}
            onClick={() => {
              move(menuIndex, 1);
              setMenu(null);
            }}
          >
            Move down
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            disabled={!menuDashboard || dashboards.length <= 1}
            onClick={() => {
              if (menuDashboard) setDeleteTarget(menuDashboard);
              setMenu(null);
            }}
          >
            Delete dashboard
          </Menu.Item>
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            onClick={() => {
              setDeleteApplicationOpen(true);
              setMenu(null);
            }}
          >
            Delete application
          </Menu.Item>
        </ContextMenu.Imperative>
      )}

      <DashboardNameDialog
        key={`create-${createOpen}`}
        open={createOpen}
        title="New dashboard"
        confirmLabel="Create dashboard"
        initialDescription=""
        initialIcon={null}
        onCancel={() => setCreateOpen(false)}
        onConfirm={(name, description, icon) =>
          createDashboard.mutate(
            { name, description, icon, applicationId: application.id },
            {
              onSuccess: created => {
                setCreateOpen(false);
                void goToDashboard(created.id);
              }
            }
          )
        }
      />

      {editTarget && (
        <DashboardNameDialog
          key={`edit-${editTarget.id}`}
          open
          title="Edit dashboard"
          confirmLabel="Save"
          initialName={editTarget.name}
          initialIcon={editTarget.icon}
          onCancel={() => setEditTarget(null)}
          onConfirm={(name, _description, icon) =>
            updateDashboard.mutate(
              { id: editTarget.id, body: { name, icon } },
              { onSuccess: () => setEditTarget(null) }
            )
          }
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
          ) : null
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const remaining = dashboards.filter(d => d.id !== deleteTarget.id);
          deleteDashboard.mutate(deleteTarget.id, {
            onSuccess: () => {
              setDeleteTarget(null);
              if (remaining[0]) void goToDashboard(remaining[0].id);
            }
          });
        }}
      />

      {editApplicationOpen && (
        <ApplicationDialog
          application={application}
          onCancel={() => setEditApplicationOpen(false)}
          onConfirm={body =>
            updateApplication.mutate(
              { id: application.id, body },
              { onSuccess: () => setEditApplicationOpen(false) }
            )
          }
        />
      )}

      <DeleteConfirmationDialog
        open={deleteApplicationOpen}
        title="Delete application?"
        message={
          <>
            The application <b>{application.name}</b> and all of its dashboards will be permanently
            deleted.
          </>
        }
        onCancel={() => setDeleteApplicationOpen(false)}
        onConfirm={() =>
          deleteApplication.mutate(application.id, {
            onSuccess: () => {
              setDeleteApplicationOpen(false);
              void navigate({ to: '/$workspaceSlug', params: { workspaceSlug } });
            }
          })
        }
      />
    </>
  );

  return { railProps, overlays };
};
