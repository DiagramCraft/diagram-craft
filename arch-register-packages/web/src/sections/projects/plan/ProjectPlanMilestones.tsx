import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DateInput } from '@diagram-craft/app-components/DateInput';
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

// In display (and sort) order
const MILESTONE_STATUSES: Milestone['status'][] = ['planned', 'active', 'complete', 'cancelled'];

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

const matchesStatusFilter = (milestone: Milestone, filter: StatusFilter) => {
  if (filter === 'all') return true;
  if (filter === 'default') return milestone.status === 'planned' || milestone.status === 'active';
  return milestone.status === filter;
};

export const ProjectPlanMilestones = ({
  project,
  editorTarget,
  onEditorTargetChange
}: {
  project: ProjectDetailData;
  // The milestone being edited, 'new' for the create dialog, or null when no dialog is open
  editorTarget: Milestone | 'new' | null;
  onEditorTargetChange: (target: Milestone | 'new' | null) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();

  const { data: milestones = [] } = useMilestones(workspaceSlug, project.id);
  const createMutation = useCreateMilestone(workspaceSlug, project.id);
  const updateMutation = useUpdateMilestone(workspaceSlug, project.id);
  const deleteMutation = useDeleteMilestone(workspaceSlug, project.id);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('default');
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);

  const count = (filter: StatusFilter) =>
    milestones.filter(m => matchesStatusFilter(m, filter)).length;
  const filtered = milestones.filter(m => matchesStatusFilter(m, statusFilter));

  const handleSave = async (data: MilestoneFormData) => {
    if (editorTarget === 'new') await createMutation.mutateAsync(data);
    else if (editorTarget) {
      await updateMutation.mutateAsync({ milestoneId: editorTarget.id, data });
    }
    onEditorTargetChange(null);
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
              { value: 'default', label: `Planned / Active (${count('default')})` },
              { value: 'complete', label: `Complete (${count('complete')})` },
              { value: 'cancelled', label: `Cancelled (${count('cancelled')})` },
              { value: 'all', label: `All (${count('all')})` }
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
                  onClick={() => onEditorTargetChange('new')}
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
          onEdit={onEditorTargetChange}
          onDelete={setDeleteTarget}
        />
      )}

      {editorTarget && (
        <MilestoneEditorDialog
          milestone={editorTarget === 'new' ? null : editorTarget}
          isSaving={createMutation.isPending || updateMutation.isPending}
          onSave={handleSave}
          onCancel={() => onEditorTargetChange(null)}
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

const COMPARATORS: Record<SortKey, (a: Milestone, b: Milestone) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  target_date: (a, b) => a.target_date.localeCompare(b.target_date),
  status: (a, b) => MILESTONE_STATUSES.indexOf(a.status) - MILESTONE_STATUSES.indexOf(b.status)
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

const MilestoneEditorDialog = ({
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
      <div className={styles.form}>
        <FormElement label="Name" required>
          <TextInput
            value={name}
            onChange={v => setName(v ?? '')}
            placeholder="e.g. Q3 platform migration"
            autoFocus
          />
        </FormElement>
        <FormElement label="Target date" required>
          <DateInput value={targetDate} onChange={v => setTargetDate(v ?? '')} />
        </FormElement>
        {!isNew && (
          <FormElement label="Status" required>
            <Select.Root
              value={status}
              onChange={v => setStatus((v ?? 'planned') as Milestone['status'])}
            >
              {MILESTONE_STATUSES.map(s => (
                <Select.Item key={s} value={s}>
                  {STATUS_LABEL[s]}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        )}
      </div>
    </Dialog>
  );
};
