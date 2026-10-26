import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import {
  TbCalendarEvent,
  TbCheck,
  TbDots,
  TbFlag,
  TbPencil,
  TbTrash,
  TbUsers
} from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { TypeBadge } from '../../../components/TypeBadge';
import { EmptyState } from '../../../components/EmptyState';
import { ToolbarFilterBar, ToolbarFilterSelect } from '../../../components/ToolbarFilter';
import { formatDate } from '../../../utils/dateFormat';
import {
  getSnapshotEffectiveDate,
  isChangeOverdue,
  type ChangeCaseMemberEntry
} from '../../entities/components/snapshotDisplay';
import {
  diffRelationSnapshotState,
  diffSnapshotState
} from '../../entities/components/entityTimelineHelpers';
import styles from './ProjectPlanPlannedChanges.module.css';

type GroupBy = 'entity' | 'date';
type ShowFilter = 'all' | 'planned' | 'applied' | 'overdue';

export const ProjectPlanPlannedChanges = ({
  project,
  changeEntries,
  relationNameById,
  relationSchemaById,
  relationSchemaIdByRelationId,
  projectEntities,
  schemaMap,
  schemas,
  lifecycleStates,
  teams,
  milestonesById,
  onApplySnapshot,
  onEditSnapshot,
  onDeleteSnapshot
}: {
  project: ProjectDetailData;
  changeEntries: ChangeCaseMemberEntry[];
  relationNameById: Map<string, string>;
  relationSchemaById: Map<string, RelationSchema>;
  relationSchemaIdByRelationId: Map<string, string>;
  projectEntities: ProjectEntity[];
  schemaMap: Map<string, { color: string; icon: string | null }>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  milestonesById: Map<string, Milestone>;
  onApplySnapshot: (entry: ChangeCaseMemberEntry) => void;
  onEditSnapshot: (entry: ChangeCaseMemberEntry) => void;
  onDeleteSnapshot: (entry: ChangeCaseMemberEntry) => void;
}) => {
  const [show, setShow] = useState<ShowFilter>('planned');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');

  if (changeEntries.length === 0) {
    return (
      <div className={styles.entityTab}>
        <EmptyState
          framed
          icon={<TbCalendarEvent size={22} />}
          title="No planned changes"
          subtitle="Use Plan change to plan changes for entities in this project."
        />
      </div>
    );
  }

  const visibleEntries = changeEntries.filter(entry => {
    const planned = entry.changeCase.status === 'planned';
    switch (show) {
      case 'planned':
        return planned;
      case 'applied':
        return entry.changeCase.status === 'applied';
      case 'overdue':
        return (
          planned && isChangeOverdue(getSnapshotEffectiveDate(entry.changeCase, milestonesById))
        );
      default:
        return true;
    }
  });

  const toolbar = (
    <div className={styles.plannedToolbar}>
      <ToolbarFilterBar noPadding>
        <ToolbarFilterSelect
          label="Show"
          value={show}
          onChange={value => setShow(value as ShowFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'planned', label: 'Planned' },
            { value: 'applied', label: 'Applied' },
            { value: 'overdue', label: 'Overdue' }
          ]}
        />
        <div className={styles.toolbarEnd}>
          <ToolbarFilterSelect
            label="Group by"
            value={groupBy}
            onChange={value => setGroupBy(value as GroupBy)}
            options={[
              { value: 'date', label: 'Date' },
              { value: 'entity', label: 'Entity' }
            ]}
          />
        </div>
      </ToolbarFilterBar>
    </div>
  );

  if (visibleEntries.length === 0) {
    return (
      <div className={styles.entityTab}>
        {toolbar}
        <EmptyState
          framed
          icon={<TbCalendarEvent size={22} />}
          title={`No ${show} changes`}
          subtitle={
            show === 'overdue'
              ? 'None of the planned changes have a target date in the past.'
              : 'Nothing matches this filter.'
          }
        />
      </div>
    );
  }

  const entityMap = new Map(projectEntities.map(e => [e.entity_id, e]));
  const nameOf = (id: string) => entityMap.get(id)?.entity_name ?? relationNameById.get(id) ?? id;
  const getRelationSchema = (entry: ChangeCaseMemberEntry) => {
    if (entry.member.kind !== 'relation') return null;
    const schemaId = relationSchemaIdByRelationId.get(entry.member.entity_id);
    return schemaId ? (relationSchemaById.get(schemaId) ?? null) : null;
  };
  const getEntitySchema = (entity: ProjectEntity | undefined) =>
    entity?.entity_schema
      ? (schemas.find(schema => schema.id === entity.entity_schema!.id) ?? null)
      : null;
  const getEntitySchemaInfo = (entity: ProjectEntity | undefined) =>
    entity?.entity_schema ? schemaMap.get(entity.entity_schema.id) : undefined;

  // Entities sharing a change case with each other — drives the "also includes" note in the
  // group-by-entity view and the nested case panels in the group-by-date view.
  const caseMembersMap = new Map<string, ChangeCaseMemberEntry[]>();
  for (const entry of visibleEntries) {
    const list = caseMembersMap.get(entry.changeCase.id);
    if (list) list.push(entry);
    else caseMembersMap.set(entry.changeCase.id, [entry]);
  }

  if (groupBy === 'entity') {
    // Group by entity_id
    const groups = new Map<string, ChangeCaseMemberEntry[]>();
    for (const entry of visibleEntries) {
      const list = groups.get(entry.member.entity_id);
      if (list) list.push(entry);
      else groups.set(entry.member.entity_id, [entry]);
    }

    return (
      <div className={styles.entityTab}>
        {toolbar}
        <div className={styles.plannedChangesGroups}>
          {[...groups.entries()].map(([entityId, snaps]) => {
            const pe = entityMap.get(entityId);
            const schema = pe?.entity_schema ? schemaMap.get(pe.entity_schema.id) : undefined;
            const relationSchema = getRelationSchema(snaps[0]!);
            return (
              <div key={entityId} className={styles.plannedGroup}>
                <div className={styles.plannedGroupHead}>
                  {schema && <TypeBadge color={schema.color} icon={schema.icon} size={16} />}
                  <span className={styles.plannedGroupName}>{nameOf(entityId)}</span>
                  {pe?.entity_schema && <Chip tone="ghost">{pe.entity_schema.name}</Chip>}
                  {relationSchema && <Chip tone="ghost">{relationSchema.name}</Chip>}
                </div>
                {snaps.map(entry => {
                  const otherEntityNames = (caseMembersMap.get(entry.changeCase.id) ?? [])
                    .filter(e => e.member.entity_id !== entityId)
                    .map(e => nameOf(e.member.entity_id));
                  return (
                    <FutureSnapshotRow
                      key={entry.member.id}
                      entry={entry}
                      showEntity={false}
                      showMilestone
                      entitySchema={getEntitySchema(pe)}
                      entitySchemaInfo={getEntitySchemaInfo(pe)}
                      relationSchema={getRelationSchema(entry)}
                      milestonesById={milestonesById}
                      lifecycleStates={lifecycleStates}
                      teams={teams}
                      canEdit={project.canEdit}
                      otherEntityNames={otherEntityNames}
                      onApply={onApplySnapshot}
                      onEdit={onEditSnapshot}
                      onDelete={onDeleteSnapshot}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Group by (effective) date — a milestone-backed snapshot has no target_date of its own, so
  // fall back to the milestone's target_date, grouping it alongside any raw-dated snapshots
  // targeting the same day.
  const groups = new Map<string, ChangeCaseMemberEntry[]>();
  for (const entry of visibleEntries) {
    const key = getSnapshotEffectiveDate(entry.changeCase, milestonesById) ?? '__no-date__';
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }

  // Sort: dated groups first (ascending), then no-date
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === '__no-date__') return 1;
    if (b === '__no-date__') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className={styles.entityTab}>
      {toolbar}
      <div className={styles.plannedChangesGroups}>
        {sortedKeys.map(key => {
          const snaps = groups.get(key)!;
          const label = key === '__no-date__' ? 'No target date' : formatDate(key, key);
          const groupMilestones = [
            ...new Map(
              snaps
                .filter(
                  (
                    entry
                  ): entry is ChangeCaseMemberEntry & { changeCase: { milestone_id: string } } =>
                    entry.changeCase.milestone_id != null
                )
                .map(entry => [
                  entry.changeCase.milestone_id,
                  milestonesById.get(entry.changeCase.milestone_id)
                ])
                .filter((entry): entry is [string, Milestone] => entry[1] != null)
            ).values()
          ];

          // Sub-group this date's entries by change case, so a case renders as one nested panel
          // (with its name/description) rather than as separate flat rows.
          const caseGroups = new Map<string, ChangeCaseMemberEntry[]>();
          const orderedCaseKeys: string[] = [];
          for (const entry of snaps) {
            const caseKey = entry.changeCase.id;
            if (!caseGroups.has(caseKey)) orderedCaseKeys.push(caseKey);
            const list = caseGroups.get(caseKey);
            if (list) list.push(entry);
            else caseGroups.set(caseKey, [entry]);
          }

          return (
            <div key={key} className={styles.plannedGroup}>
              <div className={styles.plannedGroupHead}>
                <span className={styles.plannedGroupName}>{label}</span>
                {key !== '__no-date__' &&
                  isChangeOverdue(key) &&
                  snaps.some(entry => entry.changeCase.status === 'planned') && (
                    <Chip color="var(--warning-fg)" title="The target date has passed">
                      Overdue
                    </Chip>
                  )}
                {groupMilestones.map(milestone => (
                  <Chip
                    key={milestone.id}
                    tone="accent"
                    icon={<TbFlag size={12} style={{ color: 'var(--accent-fg)' }} />}
                  >
                    {milestone.name}
                  </Chip>
                ))}
              </div>
              {orderedCaseKeys.map(caseKey => {
                const caseEntries = caseGroups.get(caseKey)!;
                const changeCase = caseEntries[0]!.changeCase;
                const fallbackTitle =
                  caseEntries.length === 1
                    ? nameOf(caseEntries[0]!.member.entity_id)
                    : 'Untitled change';
                const representativeEntry = caseEntries[0]!;
                return (
                  <div key={caseKey} className={styles.plannedCasePanel}>
                    <div className={styles.plannedCasePanelHead}>
                      <div className={styles.plannedCasePanelTitleRow}>
                        <span className={styles.plannedCasePanelName}>
                          {changeCase.name ?? fallbackTitle}
                        </span>
                        {caseEntries.length > 1 && (
                          <Chip tone="ghost">{caseEntries.length} entities</Chip>
                        )}
                        <div style={{ flex: 1 }} />
                        {changeCase.status === 'applied' && <Chip tone="ghost">Applied</Chip>}
                        {project.canEdit && changeCase.status === 'planned' && (
                          <DropdownMenu
                            trigger={
                              <Button
                                size="sm"
                                variant="icon-only"
                                aria-label="Change case actions"
                                title="Change case actions"
                                icon={<TbDots size={14} />}
                              />
                            }
                            items={[
                              {
                                label: 'Apply',
                                icon: <TbCheck size={14} />,
                                onClick: () => onApplySnapshot(representativeEntry)
                              },
                              {
                                label: 'Edit',
                                icon: <TbPencil size={14} />,
                                onClick: () => onEditSnapshot(representativeEntry)
                              },
                              {
                                label: 'Remove',
                                icon: <TbTrash size={14} />,
                                danger: true,
                                onClick: () => onDeleteSnapshot(representativeEntry)
                              }
                            ]}
                          />
                        )}
                      </div>
                      {changeCase.commit_message && (
                        <div className={styles.plannedCasePanelDescription}>
                          {changeCase.commit_message}
                        </div>
                      )}
                    </div>
                    <div className={styles.plannedCasePanelBody}>
                      {caseEntries.map(entry => {
                        const pe = entityMap.get(entry.member.entity_id);
                        return (
                          <FutureSnapshotRow
                            key={entry.member.id}
                            entry={entry}
                            showEntity={true}
                            showOverdue={false}
                            showMilestone={false}
                            showActions={false}
                            showNote={false}
                            entityName={nameOf(entry.member.entity_id)}
                            entitySchema={getEntitySchema(pe)}
                            entitySchemaInfo={getEntitySchemaInfo(pe)}
                            relationSchema={getRelationSchema(entry)}
                            milestonesById={milestonesById}
                            lifecycleStates={lifecycleStates}
                            teams={teams}
                            canEdit={project.canEdit}
                            onApply={onApplySnapshot}
                            onEdit={onEditSnapshot}
                            onDelete={onDeleteSnapshot}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FutureSnapshotRow = ({
  entry,
  showEntity,
  showMilestone,
  entityName,
  entitySchema,
  entitySchemaInfo,
  relationSchema,
  milestonesById,
  lifecycleStates,
  teams,
  canEdit,
  showActions = true,
  showNote = true,
  showOverdue = true,
  otherEntityNames = [],
  onApply,
  onEdit,
  onDelete
}: {
  entry: ChangeCaseMemberEntry;
  showEntity: boolean;
  showMilestone: boolean;
  entityName?: string;
  entitySchema: EntitySchema | null;
  entitySchemaInfo?: { color: string; icon: string | null };
  relationSchema?: RelationSchema | null;
  milestonesById: Map<string, Milestone>;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  canEdit: boolean;
  showActions?: boolean;
  showNote?: boolean;
  showOverdue?: boolean;
  otherEntityNames?: string[];
  onApply: (entry: ChangeCaseMemberEntry) => void;
  onEdit: (entry: ChangeCaseMemberEntry) => void;
  onDelete: (entry: ChangeCaseMemberEntry) => void;
}) => {
  const { changeCase, member } = entry;
  const milestone = changeCase.milestone_id
    ? milestonesById.get(changeCase.milestone_id)
    : undefined;
  const date = changeCase.target_date ?? milestone?.target_date ?? null;
  const dateLabel = date ? formatDate(date) : null;
  const changes =
    member.kind === 'relation'
      ? diffRelationSnapshotState(member.base_state, member.proposed_state, relationSchema ?? null)
      : diffSnapshotState(
          member.base_state,
          member.proposed_state,
          entitySchema,
          lifecycleStates,
          teams
        );

  return (
    <div className={styles.plannedRow}>
      {showEntity && (
        <div className={styles.plannedRowEntity}>
          {entitySchemaInfo && (
            <TypeBadge color={entitySchemaInfo.color} icon={entitySchemaInfo.icon} size={14} />
          )}
          <span>{entityName ?? member.entity_id}</span>
          {relationSchema && <Chip tone="ghost">{relationSchema.name}</Chip>}
        </div>
      )}
      {otherEntityNames.length > 0 && (
        <div className={styles.plannedRowAlsoIncludes}>
          <TbUsers size={12} />
          <span>Also includes {otherEntityNames.join(', ')}</span>
        </div>
      )}
      <div className={styles.plannedRowBody}>
        <div className={styles.plannedRowMeta}>
          {dateLabel && <span className={styles.plannedRowDate}>{dateLabel}</span>}
          {changeCase.status === 'applied' && <Chip tone="ghost">Applied</Chip>}
          {showOverdue && changeCase.status === 'planned' && isChangeOverdue(date) && (
            <Chip color="var(--warning-fg)" title="The target date has passed">
              Overdue
            </Chip>
          )}
          {showMilestone && milestone && (
            <Chip tone="accent" icon={<TbFlag size={12} style={{ color: 'var(--accent-fg)' }} />}>
              {milestone.name}
            </Chip>
          )}
          {showNote && changeCase.commit_message && (
            <span className={styles.plannedRowNote}>{changeCase.commit_message}</span>
          )}
        </div>
        {canEdit && showActions && changeCase.status === 'planned' && (
          <div className={styles.plannedRowActions}>
            <DropdownMenu
              trigger={
                <Button
                  size="sm"
                  variant="icon-only"
                  aria-label="Planned change actions"
                  title="Planned change actions"
                  icon={<TbDots size={14} />}
                />
              }
              items={[
                {
                  label: 'Apply',
                  icon: <TbCheck size={14} />,
                  onClick: () => onApply(entry)
                },
                {
                  label: 'Edit',
                  icon: <TbPencil size={14} />,
                  onClick: () => onEdit(entry)
                },
                {
                  label: 'Remove',
                  icon: <TbTrash size={14} />,
                  danger: true,
                  onClick: () => onDelete(entry)
                }
              ]}
            />
          </div>
        )}
      </div>
      <div className={styles.plannedRowChanges}>
        <div className={styles.plannedRowChangesTitle}>Changes</div>
        {changes.length > 0 ? (
          changes.map(change => (
            <div key={change.label} className={styles.plannedRowChange}>
              <span className={styles.plannedRowChangeField}>{change.label}</span>
              <span className={styles.plannedRowChangeFrom}>{change.from}</span>
              <span className={styles.plannedRowChangeArrow}>→</span>
              <span className={styles.plannedRowChangeTo}>{change.to}</span>
            </div>
          ))
        ) : (
          <span className={styles.plannedRowNoChanges}>Restricted changes</span>
        )}
      </div>
    </div>
  );
};
