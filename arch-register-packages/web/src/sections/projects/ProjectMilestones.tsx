import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { TbPlus, TbTrash, TbFlag, TbCalendarWeek } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { Milestone, CreateMilestoneRequest } from '@arch-register/api-types/milestoneContract';
import { getRouteApi } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { ProjectScreenLayout } from './ProjectScreenLayout';
import sharedStyles from './ProjectDetailScreen.module.css';
import styles from './ProjectMilestones.module.css';
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone
} from '../../hooks/useMilestones';
import { EmptyState } from '../../components/EmptyState';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

type StatusFilter = 'default' | 'complete' | 'cancelled' | 'all';

const STATUS_LABEL: Record<Milestone['status'], string> = {
  planned: 'Planned',
  active: 'Active',
  complete: 'Complete',
  cancelled: 'Cancelled'
};

const STATUS_BADGE_CLASS: Record<Milestone['status'], string> = {
  planned: styles.statusPlanned ?? '',
  active: styles.statusActive ?? '',
  complete: styles.statusComplete ?? '',
  cancelled: styles.statusCancelled ?? ''
};

export const ProjectMilestones = ({
  project,
  projectId,
  onNavigateHome,
  onNavigateProject
}: {
  project: ProjectDetailData;
  projectId: string;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
}) => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug } = useWorkspaceContext();

  const { data: milestones = [] } = useMilestones(workspaceSlug, projectId);
  const createMutation = useCreateMilestone(workspaceSlug, projectId);
  const updateMutation = useUpdateMilestone(workspaceSlug, projectId);
  const deleteMutation = useDeleteMilestone(workspaceSlug, projectId);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('default');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);

  const counts = {
    default: milestones.filter(m => m.status === 'planned' || m.status === 'active').length,
    complete: milestones.filter(m => m.status === 'complete').length,
    cancelled: milestones.filter(m => m.status === 'cancelled').length,
    all: milestones.length
  };

  const filtered = milestones.filter(m => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'default') return m.status === 'planned' || m.status === 'active';
    return m.status === statusFilter;
  });

  const handleCreate = async (data: CreateMilestoneRequest) => {
    await createMutation.mutateAsync(data);
    setCreating(false);
  };

  const handleUpdate = async (data: CreateMilestoneRequest) => {
    if (!editing) return;
    await updateMutation.mutateAsync({ milestoneId: editing.id, data });
    setEditing(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <ProjectScreenLayout
        breadcrumbs={[
          {
            label: 'Home',
            onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
          },
          { label: 'Projects', onClick: onNavigateHome },
          { label: project.name, onClick: onNavigateProject }
        ]}
        title="Milestones"
        actions={
          project.canEdit ? (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setCreating(true)}>
              New milestone
            </Button>
          ) : undefined
        }
        toolbar={
          <div className={sharedStyles.entityTabNav}>
            {(
              [
                ['default', `Planned / Active (${counts.default})`],
                ['complete', `Complete (${counts.complete})`],
                ['cancelled', `Cancelled (${counts.cancelled})`],
                ['all', `All (${counts.all})`]
              ] as [StatusFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${sharedStyles.entityTabBtn} ${statusFilter === key ? sharedStyles.entityTabBtnActive : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className={styles.list}>
            <EmptyState
              framed
              icon={<TbFlag size={20} />}
              title={
                statusFilter === 'default'
                  ? 'No planned or active milestones'
                  : statusFilter === 'complete'
                    ? 'No complete milestones'
                    : statusFilter === 'cancelled'
                      ? 'No cancelled milestones'
                      : 'No milestones yet'
              }
              subtitle="Milestones let you name and group planned entity changes around a shared target date."
              action={
                project.canEdit &&
                statusFilter !== 'cancelled' && (
                  <Button
                    variant="primary"
                    icon={<TbPlus size={12} />}
                    onClick={() => setCreating(true)}
                  >
                    New milestone
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(milestone => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                canEdit={project.canEdit}
                onEdit={() => setEditing(milestone)}
                onDelete={() => setDeleteTarget(milestone)}
              />
            ))}
          </div>
        )}
      </ProjectScreenLayout>

      {creating && (
        <MilestoneEditorDialog
          milestone={null}
          isSaving={createMutation.isPending}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && (
        <MilestoneEditorDialog
          milestone={editing}
          isSaving={updateMutation.isPending}
          onSave={handleUpdate}
          onCancel={() => setEditing(null)}
        />
      )}

      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title="Delete milestone"
        message={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
        detail="Any planned entity changes targeting this milestone will keep their target date but lose the named grouping."
        confirmLabel="Delete milestone"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

const MilestoneCard = ({
  milestone,
  canEdit,
  onEdit,
  onDelete
}: {
  milestone: Milestone;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const isCancelled = milestone.status === 'cancelled';

  return (
    // biome-ignore lint/a11y/useSemanticElements: contains a nested delete <button>, which is invalid inside a <button>
    <div
      role="button"
      tabIndex={0}
      className={`${styles.card} ${isCancelled ? styles.cardCancelled : ''}`}
      onClick={onEdit}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onEdit();
        }
      }}
    >
      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <div className={styles.cardName}>{milestone.name}</div>
          <span className={`${styles.status} ${STATUS_BADGE_CLASS[milestone.status]}`}>
            {STATUS_LABEL[milestone.status]}
          </span>
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.metaItem}>
            <TbCalendarWeek size={11} />
            {milestone.target_date}
          </span>
        </div>
      </div>
      {canEdit && (
        <div className={styles.cardActions}>
          <Button
            variant="ghost"
            icon={<TbTrash size={13} />}
            title="Delete milestone"
            onClick={event => {
              event.stopPropagation();
              onDelete();
            }}
          />
        </div>
      )}
    </div>
  );
};

export const MilestoneEditorDialog = ({
  milestone,
  isSaving,
  onSave,
  onCancel
}: {
  milestone: Milestone | null;
  isSaving: boolean;
  onSave: (data: CreateMilestoneRequest) => void;
  onCancel: () => void;
}) => {
  const isNew = !milestone;
  const [name, setName] = useState(milestone?.name ?? '');
  const [targetDate, setTargetDate] = useState(milestone?.target_date ?? '');
  const [status, setStatus] = useState<Milestone['status']>(milestone?.status ?? 'planned');
  const sortOrder = milestone?.sort_order ?? 0;

  const canSave = name.trim().length > 0 && targetDate.trim().length > 0;

  return (
    <Dialog
      open
      onClose={onCancel}
      title={isNew ? 'New milestone' : 'Edit milestone'}
      width={480}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: isSaving ? 'Saving...' : isNew ? 'Create milestone' : 'Save changes',
          type: 'default',
          disabled: !canSave || isSaving,
          onClick: () =>
            onSave({
              name: name.trim(),
              target_date: targetDate,
              status,
              sort_order: sortOrder
            })
        }
      ]}
    >
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Basic info</div>
        <TextInput
          value={name}
          onChange={v => setName(v ?? '')}
          placeholder="e.g. Q3 platform migration"
          style={{ width: '100%' }}
        />
        <div className={styles.formRow}>
          <label>Target date</label>
          <input
            className={styles.dateInput}
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
          />
        </div>
      </div>

      {!isNew && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Status</div>
          <div style={{ width: 160 }}>
            <Select.Root
              value={status}
              onChange={v => setStatus((v ?? 'planned') as Milestone['status'])}
            >
              {(Object.keys(STATUS_LABEL) as Milestone['status'][]).map(s => (
                <Select.Item key={s} value={s}>
                  {STATUS_LABEL[s]}
                </Select.Item>
              ))}
            </Select.Root>
          </div>
        </div>
      )}
    </Dialog>
  );
};
