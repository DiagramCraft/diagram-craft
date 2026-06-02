import { useMemo, useState, Fragment, useEffect } from 'react';
import { WORKSPACE_CAPABILITY_GROUPS } from '@arch-register/permissions';
import { TbCheck, TbPencil, TbPlus, TbTrash } from 'react-icons/tb';
import { ApiError, type WorkspaceRoleDefinition } from '../api';
import type { WorkspaceRoleCapability } from '@arch-register/api-types';
import { useAuth } from '../auth/AuthContext';
import { ColorPicker } from '../components/ColorPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { useWorkspaceMembers } from '../hooks/useWorkspaceMembers';
import {
  useCreateWorkspaceRole,
  useDeleteWorkspaceRole,
  useUpdateWorkspaceRole,
  useWorkspaceRoles,
} from '../hooks/useWorkspaceRoles';
import styles from './RolesPermissionsSection.module.css';

type RoleDraft = {
  name: string;
  description: string;
  tone: string;
  capabilities: WorkspaceRoleCapability[];
};

const buildDraft = (role?: WorkspaceRoleDefinition | null): RoleDraft => ({
  name: role?.name ?? '',
  description: role?.description ?? '',
  tone: role?.tone ?? 'var(--accent-fg)',
  capabilities: role?.capabilities ?? [],
});

const sortRoles = (roles: WorkspaceRoleDefinition[]) =>
  [...roles].sort((left, right) => {
    if (left.builtin !== right.builtin) return left.builtin ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

export const RolesPermissionsSection = ({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const { data: members = [] } = useWorkspaceMembers(workspaceSlug);
  const { data: fetchedRoles = [], error } = useWorkspaceRoles(workspaceSlug);
  const createRole = useCreateWorkspaceRole(workspaceSlug);
  const updateRole = useUpdateWorkspaceRole(workspaceSlug);
  const deleteRole = useDeleteWorkspaceRole(workspaceSlug);
  const { reloadUser } = useAuth();

  const roles = useMemo(() => sortRoles(fetchedRoles), [fetchedRoles]);

  useEffect(() => {
    if (selectedRole == null && roles.length > 0) {
      setSelectedRole(roles[0]?.id ?? null);
      return;
    }
    if (selectedRole != null && !roles.some(role => role.id === selectedRole)) {
      setSelectedRole(roles[0]?.id ?? null);
    }
  }, [roles, selectedRole]);

  const selectedRoleDefinition = roles.find(role => role.id === selectedRole) ?? null;
  const editRole = roles.find(role => role.id === editRoleId) ?? null;
  const deleteRoleDefinition = roles.find(role => role.id === deleteRoleId) ?? null;

  const memberCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const member of members) {
      counts[member.role] = (counts[member.role] ?? 0) + 1;
    }
    return counts;
  }, [members]);

  if (error) {
    return <div className={styles.container}>Failed to load workspace roles.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.roleGrid}>
        {roles.map(role => {
          const isSelected = selectedRole === role.id;
          return (
            <div
              key={role.id}
              className={`${styles.roleCard} ${isSelected ? styles.roleCardSelected : ''}`}
              onClick={() => setSelectedRole(isSelected ? null : role.id)}
            >
              <div className={styles.roleCardHeader}>
                <span className={styles.rolePill}>
                  <span className={styles.roleDot} style={{ background: role.tone }} />
                  {role.name}
                </span>
                {role.builtin && <span className={styles.builtinChip}>Built-in</span>}
              </div>
              <div className={styles.roleDescription}>{role.description}</div>
              <div className={styles.roleStats}>
                <span>
                  <span className={styles.roleStatValue}>{memberCountByRole[role.id] ?? 0}</span> members
                </span>
                <span>
                  <span className={styles.roleStatValue}>{role.capabilities.length}</span> capabilities
                </span>
              </div>
              {!role.builtin && (
                <div className={styles.roleActions}>
                  <button
                    type="button"
                    className={styles.roleActionBtn}
                    onClick={event => {
                      event.stopPropagation();
                      setEditRoleId(role.id);
                    }}
                  >
                    <TbPencil size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    className={styles.roleActionBtn}
                    onClick={event => {
                      event.stopPropagation();
                      setDeleteRoleId(role.id);
                    }}
                  >
                    <TbTrash size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <button type="button" className={styles.addRoleCard} onClick={() => setCreateOpen(true)}>
          <TbPlus size={16} />
          Create custom role
        </button>
      </div>

      <div className={styles.matrixWrap}>
        <table className={styles.matrix}>
          <thead>
            <tr className={styles.matrixHeaderRow}>
              <th>Capability</th>
              {roles.map(role => (
                <th
                  key={role.id}
                  className={selectedRoleDefinition?.id === role.id ? styles.matrixColHighlight : undefined}
                >
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WORKSPACE_CAPABILITY_GROUPS.map(group => (
              <Fragment key={group.label}>
                <tr className={styles.matrixGroupRow}>
                  <td colSpan={roles.length + 1}>{group.label}</td>
                </tr>
                {group.caps.map(cap => (
                  <tr key={cap.id} className={styles.matrixCapRow}>
                    <td className={styles.matrixCapName}>{cap.name}</td>
                    {roles.map(role => {
                      const has = role.capabilities.includes(cap.id);
                      const highlight = selectedRoleDefinition?.id === role.id;
                      return (
                        <td
                          key={role.id}
                          className={highlight ? styles.matrixColHighlight : undefined}
                        >
                          {has ? (
                            <span className={styles.matrixCheck}><TbCheck /></span>
                          ) : (
                            <span className={styles.matrixDash}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <RoleEditorDialog
        open={createOpen}
        title="Create custom role"
        initialRole={null}
        pending={createRole.isPending}
        errorMessage={createRole.error instanceof Error ? createRole.error.message : null}
        onClose={() => setCreateOpen(false)}
        onSave={async draft => {
          await createRole.mutateAsync(draft);
          await reloadUser();
          setCreateOpen(false);
        }}
      />

      <RoleEditorDialog
        open={editRole != null}
        title={editRole ? `Edit ${editRole.name}` : 'Edit role'}
        initialRole={editRole}
        pending={updateRole.isPending}
        errorMessage={updateRole.error instanceof Error ? updateRole.error.message : null}
        onClose={() => setEditRoleId(null)}
        onSave={async draft => {
          if (!editRole) return;
          await updateRole.mutateAsync({ roleId: editRole.id, role: draft });
          await reloadUser();
          setEditRoleId(null);
        }}
      />

      <RoleDeleteConfirmDialog
        open={deleteRoleDefinition != null}
        role={deleteRoleDefinition}
        pending={deleteRole.isPending}
        error={deleteRole.error instanceof Error ? deleteRole.error : null}
        onClose={() => setDeleteRoleId(null)}
        onDelete={async () => {
          if (!deleteRoleDefinition) return;
          await deleteRole.mutateAsync(deleteRoleDefinition.id);
          await reloadUser();
          setDeleteRoleId(null);
        }}
      />
    </div>
  );
};

const RoleEditorDialog = ({
  open,
  title,
  initialRole,
  pending,
  errorMessage,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initialRole: WorkspaceRoleDefinition | null;
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSave: (draft: RoleDraft) => Promise<void>;
}) => {
  const [draft, setDraft] = useState<RoleDraft>(buildDraft(initialRole));

  useEffect(() => {
    setDraft(buildDraft(initialRole));
  }, [initialRole]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title={title} panelClassName={styles.dialogPanel}>
      <div className={styles.dialogBody}>
        <label className={styles.dialogField}>
          <span className={styles.dialogLabel}>
            Name <span className={styles.requiredMark}>Required</span>
          </span>
          <input
            className={styles.dialogInput}
            value={draft.name}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
            disabled={pending}
          />
        </label>
        <label className={styles.dialogField}>
          <span className={styles.dialogLabel}>
            Description <span className={styles.requiredMark}>Required</span>
          </span>
          <textarea
            className={styles.dialogTextarea}
            value={draft.description}
            onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
            disabled={pending}
          />
        </label>
        <label className={styles.dialogField}>
          <span className={styles.dialogLabel}>Role color <span className={styles.optionalMark}>Optional</span></span>
          <div className={styles.colorPickerWrap}>
            <ColorPicker
              value={draft.tone}
              onChange={color => setDraft(current => ({ ...current, tone: color ?? 'var(--accent-fg)' }))}
              disabled={pending}
              size="small"
            />
          </div>
        </label>
        <div className={styles.dialogMeta}>Capabilities are optional. Leave them all unchecked to create a no-access placeholder role.</div>
        <div className={styles.capabilityList}>
          {WORKSPACE_CAPABILITY_GROUPS.map(group => (
            <div key={group.label} className={styles.capabilityGroup}>
              <div className={styles.capabilityGroupTitle}>{group.label}</div>
              {group.caps.map(cap => (
                <label key={cap.id} className={styles.capabilityRow}>
                  <input
                    type="checkbox"
                    className={styles.capabilityCheckbox}
                    checked={draft.capabilities.includes(cap.id)}
                    onChange={() =>
                      setDraft(current => ({
                        ...current,
                        capabilities: current.capabilities.includes(cap.id)
                          ? current.capabilities.filter(existing => existing !== cap.id)
                          : [...current.capabilities, cap.id],
                      }))
                    }
                    disabled={pending}
                  />
                  <span>{cap.name}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        {errorMessage && <div className={styles.dialogError}>{errorMessage}</div>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogBtn} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.dialogBtnPrimary}
            onClick={() => void onSave(draft)}
            disabled={pending || draft.name.trim().length === 0 || draft.description.trim().length === 0}
          >
            {pending ? 'Saving…' : 'Save role'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

const RoleDeleteConfirmDialog = ({
  open,
  role,
  pending,
  error,
  onClose,
  onDelete,
}: {
  open: boolean;
  role: WorkspaceRoleDefinition | null;
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) => {
  if (!open || !role) return null;

  const message =
    error instanceof ApiError && error.status === 409
      ? `${role.name} is still assigned to workspace members. Reassign those members before deleting the role.`
      : error?.message ?? null;

  return (
    <ConfirmDialog
      open={open}
      title={`Delete ${role.name}?`}
      message={`This will permanently remove the custom role "${role.name}".`}
      detail={message ?? 'Built-in roles cannot be deleted, and assigned custom roles must be unassigned first.'}
      confirmLabel={pending ? 'Deleting…' : 'Delete role'}
      onCancel={onClose}
      onConfirm={() => {
        if (!pending) {
          void onDelete();
        }
      }}
    />
  );
};
