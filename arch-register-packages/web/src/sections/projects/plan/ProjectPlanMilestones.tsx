import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { TbPlus, TbTrash, TbFlag, TbPencil } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { Milestone, CreateMilestoneRequest } from '@arch-register/api-types/milestoneContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import styles from './ProjectPlanMilestones.module.css';
import { DropdownMenu } from '../../../components/DropdownMenu';
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone
} from '../../../hooks/useMilestones';
import { EmptyState } from '../../../components/EmptyState';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { ToolbarFilterBar, ToolbarFilterSelect } from '../../../components/ToolbarFilter';

type StatusFilter = 'default' | 'complete' | 'cancelled' | 'all';
type MilestoneFormData = Omit<CreateMilestoneRequest, 'project_id'>;

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

export const ProjectPlanMilestones = ({
  project,
  creating,
  onCreatingChange
}: {
  project: ProjectDetailData;
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();

  const { data: milestones = [] } = useMilestones(workspaceSlug, project.id);
  const createMutation = useCreateMilestone(workspaceSlug, project.id);
  const updateMutation = useUpdateMilestone(workspaceSlug, project.id);
  const deleteMutation = useDeleteMilestone(workspaceSlug, project.id);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('default');
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

  const handleCreate = async (data: MilestoneFormData) => {
    await createMutation.mutateAsync(data);
    onCreatingChange(false);
  };

  const handleUpdate = async (data: MilestoneFormData) => {
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
      <div className={styles.filterBar}>
        <ToolbarFilterBar noPadding>
          <ToolbarFilterSelect
            label="Status"
            value={statusFilter}
            onChange={value => setStatusFilter(value as StatusFilter)}
            options={[
              { value: 'default', label: `Planned / Active (${counts.default})` },
              { value: 'complete', label: `Complete (${counts.complete})` },
              { value: 'cancelled', label: `Cancelled (${counts.cancelled})` },
              { value: 'all', label: `All (${counts.all})` }
            ]}
          />
        </ToolbarFilterBar>
      </div>
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
                  onClick={() => onCreatingChange(true)}
                >
                  New milestone
                </Button>
              )
            }
          />
        </div>
      ) : (
        <MilestoneTable
          milestones={filtered}
          canEdit={project.canEdit}
          onEdit={setEditing}
          onDelete={setDeleteTarget}
        />
      )}

      {creating && (
        <MilestoneEditorDialog
          milestone={null}
          isSaving={createMutation.isPending}
          onSave={handleCreate}
          onCancel={() => onCreatingChange(false)}
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

type SortKey = 'name' | 'target_date' | 'status';

const STATUS_ORDER: Record<Milestone['status'], number> = {
  planned: 0,
  active: 1,
  complete: 2,
  cancelled: 3
};

const COMPARATORS: Record<SortKey, (a: Milestone, b: Milestone) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  target_date: (a, b) => a.target_date.localeCompare(b.target_date),
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
};

const MilestoneTable = ({
  milestones,
  canEdit,
  onEdit,
  onDelete
}: {
  milestones: Milestone[];
  canEdit: boolean;
  onEdit: (milestone: Milestone) => void;
  onDelete: (milestone: Milestone) => void;
}) => {
  const { sorted, sort, toggleSort } = useTableSort<Milestone, SortKey>(milestones, COMPARATORS, {
    key: 'target_date',
    dir: 'asc'
  });

  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
            Name
          </Table.SortableHeaderCell>
          <Table.SortableHeaderCell sortKey="target_date" sort={sort} onSort={toggleSort}>
            Target date
          </Table.SortableHeaderCell>
          <Table.SortableHeaderCell sortKey="status" sort={sort} onSort={toggleSort}>
            Status
          </Table.SortableHeaderCell>
          {canEdit && <Table.HeaderCell width={40} />}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.map(milestone => (
          <Table.Row
            key={milestone.id}
            muted={milestone.status === 'cancelled'}
            onClick={canEdit ? () => onEdit(milestone) : undefined}
          >
            <Table.NameCell
              icon={<TbFlag size={14} />}
              title={milestone.name}
              titleMuted={milestone.status === 'cancelled'}
            />
            <Table.Cell>{milestone.target_date}</Table.Cell>
            <Table.Cell>
              <span className={`${styles.status} ${STATUS_BADGE_CLASS[milestone.status]}`}>
                {STATUS_LABEL[milestone.status]}
              </span>
            </Table.Cell>
            {canEdit && (
              <Table.ActionsCell>
                <DropdownMenu
                  trigger={<Table.DotsButton aria-label={`Actions for ${milestone.name}`} />}
                  items={[
                    {
                      label: 'Edit',
                      icon: <TbPencil size={14} />,
                      onClick: () => onEdit(milestone)
                    },
                    {
                      label: 'Remove',
                      icon: <TbTrash size={14} />,
                      danger: true,
                      onClick: () => onDelete(milestone)
                    }
                  ]}
                />
              </Table.ActionsCell>
            )}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
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
  onSave: (data: MilestoneFormData) => void;
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
