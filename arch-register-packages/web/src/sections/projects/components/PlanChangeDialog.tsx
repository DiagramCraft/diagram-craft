import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { useEntity } from '../../../hooks/useEntities';
import { useProjectEntities } from '../../../hooks/useProjects';
import { useMilestones } from '../../../hooks/useMilestones';
import {
  useChangeCase,
  useCreateChangeCase,
  useUpdateChangeCase,
  useAddChangeCaseMember,
  useRemoveChangeCaseMember,
  useUpdateChangeCaseMember
} from '../../../hooks/useChangeCases';
import { createEntityEditState, type EntityEditState } from '../../../lib/entityEditState';
import { buildProposedState } from '../../../lib/entityProposedStateBuilder';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { LoadingState } from '../../../components/LoadingState';
import { EntityProposedStateFields } from './EntityProposedStateFields';
import styles from './PlanChangeDialog.module.css';

type Props = {
  open: boolean;
  workspaceId: string;
  projectId: string;
  schemas: EntitySchema[];
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  // Seeds the entity picker with one entity, for "plan a change" opened from a single entity row.
  initialEntityId?: string | null;
  // When set, loads and edits this existing not-yet-applied case instead of creating a new one.
  editCaseId?: string | null;
  onClose: () => void;
};

type MemberEditorProps = {
  workspaceId: string;
  entityId: string;
  entityName: string;
  schemas: EntitySchema[];
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  existingProposedState?: Record<string, unknown> | null;
  onRemove: () => void;
  onProposedStateChange: (entityId: string, proposedState: Record<string, unknown>) => void;
};

const MemberEditor = ({
  workspaceId,
  entityId,
  entityName,
  schemas,
  teams,
  lifecycleStates,
  existingProposedState,
  onRemove,
  onProposedStateChange
}: MemberEditorProps) => {
  const { data: entity } = useEntity(workspaceId, entityId);
  const schema = entity ? (schemas.find(s => s.id === entity._schema.id) ?? null) : null;
  const [planState, setPlanState] = useState<EntityEditState | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: existingProposedState is only read once, on initial load
  useEffect(() => {
    if (!entity || !schema || planState !== null) return;
    const state = createEntityEditState(entity, schema);
    if (existingProposedState) {
      const proposedData =
        (existingProposedState['data'] as Record<string, unknown> | undefined) ?? {};
      state._name = existingProposedState['name'] ?? state._name;
      state._description = existingProposedState['description'] ?? state._description;
      state._owner = existingProposedState['owner'] ?? '';
      state._lifecycle = existingProposedState['lifecycle'] ?? '';
      state._targetLifecycle = existingProposedState['target_lifecycle'] ?? '';
      state._targetLifecycleDate = existingProposedState['target_lifecycle_date'] ?? '';
      for (const field of schema.fields) {
        state[field.id] = proposedData[field.id] ?? state[field.id];
      }
    }
    setPlanState(state);
  }, [entity, schema, planState]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onProposedStateChange is a fresh callback each render; including it would create a render loop
  useEffect(() => {
    if (entity && schema && planState) {
      onProposedStateChange(
        entityId,
        buildProposedState(entity, schema, planState, existingProposedState)
      );
    }
  }, [entity, schema, planState, entityId]);

  return (
    <div className={styles.memberSection}>
      <div className={styles.memberSectionHeader}>
        <span>{entityName}</span>
        <button type="button" className={styles.removeMemberButton} onClick={onRemove}>
          Remove
        </button>
      </div>
      {!entity || !schema || !planState ? (
        <LoadingState text="Loading..." size="sm" />
      ) : (
        <EntityProposedStateFields
          schema={schema}
          planState={planState}
          setPlanState={updater => setPlanState(prev => (prev ? updater(prev) : prev))}
          teams={teams}
          lifecycleStates={lifecycleStates}
        />
      )}
    </div>
  );
};

export const PlanChangeDialog = ({
  open,
  workspaceId,
  projectId,
  schemas,
  teams,
  lifecycleStates,
  initialEntityId,
  editCaseId,
  onClose
}: Props) => {
  const isEditing = !!editCaseId;
  const { data: projectEntities = [] } = useProjectEntities(workspaceId, projectId);
  const { data: milestones = [] } = useMilestones(workspaceId, projectId, open);
  const { data: existingCase } = useChangeCase(
    workspaceId,
    projectId,
    editCaseId ?? '',
    open && isEditing
  );
  const createChangeCase = useCreateChangeCase(workspaceId, projectId);
  const updateChangeCase = useUpdateChangeCase(workspaceId, projectId);
  const addMember = useAddChangeCaseMember(workspaceId, projectId);
  const removeMember = useRemoveChangeCaseMember(workspaceId, projectId);
  const updateMember = useUpdateChangeCaseMember(workspaceId, projectId);

  const [step, setStep] = useState<'select' | 'edit'>('select');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [proposedStates, setProposedStates] = useState<Record<string, Record<string, unknown>>>({});
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }
    if (isEditing) return; // wait for existingCase to load, handled below
    setStep('select');
    setSearch('');
    setSelectedIds(new Set(initialEntityId ? [initialEntityId] : []));
    setProposedStates({});
    setName('');
    setTargetDate('');
    setMilestoneId('');
    setCommitMessage('');
  }, [open, isEditing, initialEntityId]);

  useEffect(() => {
    if (!open || !isEditing || !existingCase || initialized) return;
    setStep('edit');
    setSearch('');
    setSelectedIds(new Set(existingCase.members.map(m => m.entity_id)));
    setProposedStates({});
    setName(existingCase.name ?? '');
    setTargetDate(existingCase.target_date ?? '');
    setMilestoneId(existingCase.milestone_id ?? '');
    setCommitMessage(existingCase.commit_message ?? '');
    setInitialized(true);
  }, [open, isEditing, existingCase, initialized]);

  const filteredEntities = projectEntities.filter(e => {
    if (!search.trim()) return true;
    const lower = search.toLowerCase();
    return `${e.entity_name} ${e.entity_slug}`.toLowerCase().includes(lower);
  });

  const toggleEntity = (entityId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  };

  const removeSelected = (entityId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(entityId);
      return next;
    });
    setProposedStates(prev => {
      const { [entityId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleTargetDateChange = (value: string) => {
    setTargetDate(value);
    if (value) setMilestoneId('');
  };

  const handleMilestoneChange = (value: string) => {
    setMilestoneId(value);
    if (value) setTargetDate('');
  };

  const selectedEntities = projectEntities.filter(e => selectedIds.has(e.entity_id));
  const allStatesReady = selectedEntities.every(e => proposedStates[e.entity_id] !== undefined);
  const nameIsValid = name.trim().length > 0;
  const canSave =
    !isSaving && allStatesReady && selectedEntities.length > 0 && nameIsValid && (!isEditing || !!existingCase);

  const handleSubmit = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      if (!isEditing) {
        const members = selectedEntities.map(({ entity_id }) => ({
          entityId: entity_id,
          proposedState: proposedStates[entity_id]!
        }));
        await createChangeCase.mutateAsync({
          name,
          targetDate: milestoneId ? null : (targetDate || null),
          milestoneId: milestoneId || null,
          commitMessage: commitMessage || null,
          members
        });
      } else {
        const caseId = editCaseId!;
        const originalMemberIds = new Map(
          (existingCase?.members ?? []).map(m => [m.entity_id, m.id])
        );

        await updateChangeCase.mutateAsync({
          caseId,
          name,
          targetDate: milestoneId ? null : (targetDate || null),
          milestoneId: milestoneId || null,
          commitMessage: commitMessage || null
        });

        for (const [entityId, memberId] of originalMemberIds) {
          if (!selectedIds.has(entityId)) {
            await removeMember.mutateAsync({ caseId, memberId });
          }
        }
        for (const entity of selectedEntities) {
          const proposedState = proposedStates[entity.entity_id]!;
          const existingMemberId = originalMemberIds.get(entity.entity_id);
          if (existingMemberId) {
            await updateMember.mutateAsync({ caseId, memberId: existingMemberId, proposedState });
          } else {
            await addMember.mutateAsync({ caseId, entityId: entity.entity_id, proposedState });
          }
        }
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Plan change"
      width={step === 'edit' ? 640 : 500}
      buttons={
        step === 'select'
          ? [
              { label: 'Cancel', type: 'cancel', onClick: onClose },
              {
                label: 'Next',
                type: 'default',
                disabled: selectedIds.size === 0,
                onClick: () => setStep('edit')
              }
            ]
          : [
              { label: 'Back', type: 'cancel', onClick: () => setStep('select') },
              {
                label: isSaving ? 'Saving...' : 'Save plan',
                type: 'default',
                disabled: !canSave,
                onClick: () => void handleSubmit()
              }
            ]
      }
    >
      {isEditing && !existingCase ? (
        <LoadingState text="Loading..." size="sm" />
      ) : step === 'select' ? (
        <div className={styles.body}>
          <FormElement label="Search entities" required={false}>
            <TextInput
              variant="search"
              value={search}
              placeholder="Type to search entities in this project…"
              onChange={v => setSearch(v ?? '')}
              onClear={() => setSearch('')}
              style={{ width: '100%' }}
            />
          </FormElement>
          <div>
            <div className={styles.label}>Entities</div>
            <div className={styles.entityList}>
              {filteredEntities.length === 0 ? (
                <div className={styles.emptyList}>
                  {search ? 'No entities match that search.' : 'This project has no entities yet.'}
                </div>
              ) : (
                filteredEntities.map(e => (
                  <label key={e.entity_id} className={styles.entityRow}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(e.entity_id)}
                      onChange={() => toggleEntity(e.entity_id)}
                    />
                    <span className={styles.entityRowLabel}>{e.entity_name}</span>
                    {e.entity_schema && (
                      <span className={styles.entityRowType}>{e.entity_schema.name}</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.body}>
          <FormElement label="Case name" required>
            <TextInput value={name} onChange={v => setName(v ?? '')} style={{ width: '100%' }} />
          </FormElement>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <FormElement label="Target date" required style={{ flex: 1 }}>
              <DateInput
                value={targetDate}
                onChange={v => handleTargetDateChange(v ?? '')}
                style={{ width: '100%' }}
              />
            </FormElement>
            <div className={styles.dateMilestoneOr}>or</div>
            <FormElement label="Milestone" required style={{ flex: 1 }}>
              <Select.Root
                value={milestoneId}
                placeholder="Select milestone…"
                onChange={v => handleMilestoneChange(v ?? '')}
              >
                {milestones.map(m => (
                  <Select.Item key={m.id} value={m.id}>
                    {m.name} ({m.target_date})
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          </div>
          <FormElement label="Note" required={false} hint="Describe what is planned to change">
            <TextInput
              value={commitMessage}
              onChange={v => setCommitMessage(v ?? '')}
              placeholder="e.g. Split this service into two"
              style={{ width: '100%' }}
            />
          </FormElement>

          {selectedEntities.map(e => (
            <MemberEditor
              key={e.entity_id}
              workspaceId={workspaceId}
              entityId={e.entity_id}
              entityName={e.entity_name}
              schemas={schemas}
              teams={teams}
              lifecycleStates={lifecycleStates}
              existingProposedState={existingCase?.members.find(m => m.entity_id === e.entity_id)
                ?.proposed_state}
              onProposedStateChange={(entityId, proposedState) =>
                setProposedStates(prev => ({ ...prev, [entityId]: proposedState }))
              }
              onRemove={() => removeSelected(e.entity_id)}
            />
          ))}
        </div>
      )}
    </Dialog>
  );
};
