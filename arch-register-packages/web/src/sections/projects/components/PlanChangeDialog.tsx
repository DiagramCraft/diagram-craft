import { useEffect, useRef, useState } from 'react';
import { TbPlus, TbX } from 'react-icons/tb';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { useEntity } from '../../../hooks/useEntities';
import { useProjectEntities } from '../../../hooks/useProjects';
import { useMilestones } from '../../../hooks/useMilestones';
import { useAutoFocus } from '../../../hooks/useAutoFocus';
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
  // Seeds the entity list with one entity, for "plan a change" opened from a single entity row.
  initialEntityId?: string | null;
  // When set, loads and edits this existing not-yet-applied case instead of creating a new one.
  editCaseId?: string | null;
  onClose: () => void;
};

const isReferenceField = (f: EntitySchema['fields'][number]) =>
  f.type === 'reference' || f.type === 'containment';

const normalize = (value: unknown): string => {
  if (value == null) return '';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
};

const computeChangedLabels = (
  entity: { _name?: string; _description?: string; _owner?: { id: string } | null } & Record<
    string,
    unknown
  >,
  schema: EntitySchema,
  planState: EntityEditState
): string[] => {
  const labels: string[] = [];
  const check = (label: string, current: unknown, next: unknown) => {
    if (normalize(current) !== normalize(next)) labels.push(label);
  };
  check('Name', entity['_name'] ?? '', planState['_name'] ?? '');
  check('Description', entity['_description'] ?? '', planState['_description'] ?? '');
  check(
    'Owner',
    (entity['_owner'] as { id: string } | null)?.id ?? '',
    planState['_owner'] ?? ''
  );
  check(
    'Lifecycle',
    (entity['_lifecycle'] as { id: string } | null)?.id ?? '',
    planState['_lifecycle'] ?? ''
  );
  check(
    'Target Lifecycle',
    (entity['_targetLifecycle'] as { id: string } | null)?.id ?? '',
    planState['_targetLifecycle'] ?? ''
  );
  check(
    'Target Lifecycle Date',
    entity['_targetLifecycleDate'] ?? '',
    planState['_targetLifecycleDate'] ?? ''
  );
  for (const field of schema.fields) {
    if (isReferenceField(field)) continue;
    check(field.name, entity[field.id], planState[field.id]);
  }
  return labels;
};

type MemberEditorProps = {
  workspaceId: string;
  entityId: string;
  isActive: boolean;
  schemas: EntitySchema[];
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  existingProposedState?: Record<string, unknown> | null;
  onProposedStateChange: (entityId: string, proposedState: Record<string, unknown>) => void;
  onChangedLabelsChange: (entityId: string, labels: string[]) => void;
};

const MemberEditor = ({
  workspaceId,
  entityId,
  isActive,
  schemas,
  teams,
  lifecycleStates,
  existingProposedState,
  onProposedStateChange,
  onChangedLabelsChange
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: onProposedStateChange/onChangedLabelsChange are fresh callbacks each render; including them would create a render loop
  useEffect(() => {
    if (!entity || !schema || !planState) return;
    onProposedStateChange(
      entityId,
      buildProposedState(entity, schema, planState, existingProposedState)
    );
    onChangedLabelsChange(entityId, computeChangedLabels(entity, schema, planState));
  }, [entity, schema, planState, entityId]);

  return (
    <div style={{ display: isActive ? undefined : 'none' }}>
      {!entity || !schema || !planState ? (
        <LoadingState text="Loading..." size="sm" />
      ) : (
        <div className={styles.editorPaneContent}>
          <EntityProposedStateFields
            schema={schema}
            planState={planState}
            setPlanState={updater => setPlanState(prev => (prev ? updater(prev) : prev))}
            teams={teams}
            lifecycleStates={lifecycleStates}
          />
        </div>
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

  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [proposedStates, setProposedStates] = useState<Record<string, Record<string, unknown>>>({});
  const [changedLabels, setChangedLabels] = useState<Record<string, string[]>>({});
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [addEntitySearch, setAddEntitySearch] = useState('');
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const addEntitySearchRef = useRef<HTMLInputElement>(null);
  useAutoFocus(addEntitySearchRef, { enabled: isAddingEntity, delay: 40 });

  useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }
    if (isEditing) return; // wait for existingCase to load, handled below
    const initialIds = initialEntityId ? [initialEntityId] : [];
    setMemberIds(initialIds);
    setActiveEntityId(initialIds[0] ?? null);
    setIsAddingEntity(false);
    setAddEntitySearch('');
    setProposedStates({});
    setChangedLabels({});
    setName('');
    setTargetDate('');
    setMilestoneId('');
    setCommitMessage('');
  }, [open, isEditing, initialEntityId]);

  useEffect(() => {
    if (!open || !isEditing || !existingCase || initialized) return;
    const ids = existingCase.members.map(m => m.entity_id);
    setMemberIds(ids);
    setActiveEntityId(ids[0] ?? null);
    setIsAddingEntity(false);
    setAddEntitySearch('');
    setProposedStates({});
    setChangedLabels({});
    setName(existingCase.name ?? '');
    setTargetDate(existingCase.target_date ?? '');
    setMilestoneId(existingCase.milestone_id ?? '');
    setCommitMessage(existingCase.commit_message ?? '');
    setInitialized(true);
  }, [open, isEditing, existingCase, initialized]);

  const entityById = new Map(projectEntities.map(e => [e.entity_id, e]));
  const candidateEntities = projectEntities.filter(e => {
    if (memberIds.includes(e.entity_id)) return false;
    if (!addEntitySearch.trim()) return true;
    const lower = addEntitySearch.toLowerCase();
    return `${e.entity_name} ${e.entity_slug}`.toLowerCase().includes(lower);
  });

  const addEntity = (entityId: string) => {
    setMemberIds(prev => [...prev, entityId]);
    setActiveEntityId(entityId);
    setIsAddingEntity(false);
    setAddEntitySearch('');
  };

  const removeEntity = (entityId: string) => {
    const next = memberIds.filter(id => id !== entityId);
    setMemberIds(next);
    if (activeEntityId === entityId) setActiveEntityId(next[0] ?? null);
    setProposedStates(prev => {
      const { [entityId]: _removed, ...rest } = prev;
      return rest;
    });
    setChangedLabels(prev => {
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

  const allStatesReady = memberIds.every(id => proposedStates[id] !== undefined);
  const nameIsValid = name.trim().length > 0;
  const canSave =
    !isSaving &&
    allStatesReady &&
    memberIds.length > 0 &&
    nameIsValid &&
    (!isEditing || !!existingCase);

  const handleSubmit = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      if (!isEditing) {
        const members = memberIds.map(entityId => ({
          entityId,
          proposedState: proposedStates[entityId]!
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
          if (!memberIds.includes(entityId)) {
            await removeMember.mutateAsync({ caseId, memberId });
          }
        }
        for (const entityId of memberIds) {
          const proposedState = proposedStates[entityId]!;
          const existingMemberId = originalMemberIds.get(entityId);
          if (existingMemberId) {
            await updateMember.mutateAsync({ caseId, memberId: existingMemberId, proposedState });
          } else {
            await addMember.mutateAsync({ caseId, entityId, proposedState });
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
      width={820}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: isSaving ? 'Saving...' : 'Save plan',
          type: 'default',
          disabled: !canSave,
          onClick: () => void handleSubmit()
        }
      ]}
    >
      {isEditing && !existingCase ? (
        <LoadingState text="Loading..." size="sm" />
      ) : (
        <div className={styles.body}>
          <div className={styles.sharedFields}>
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
          </div>

          <div className={styles.layout}>
            <div className={styles.entityPane}>
              {isAddingEntity ? (
                <div className={styles.addEntityPanel}>
                  <div className={styles.addEntitySearch}>
                    <TextInput
                      ref={addEntitySearchRef}
                      variant="search"
                      value={addEntitySearch}
                      placeholder="Search entities…"
                      onChange={v => setAddEntitySearch(v ?? '')}
                      onClear={() => setAddEntitySearch('')}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className={styles.addEntityList}>
                    {candidateEntities.length === 0 ? (
                      <div className={styles.emptyList}>No matching entities.</div>
                    ) : (
                      candidateEntities.map(e => (
                        <button
                          key={e.entity_id}
                          type="button"
                          className={styles.addEntityItem}
                          onClick={() => addEntity(e.entity_id)}
                        >
                          {e.entity_name}
                        </button>
                      ))
                    )}
                  </div>
                  <div className={styles.entityPaneFooter}>
                    <button
                      type="button"
                      className={styles.addEntityButton}
                      onClick={() => setIsAddingEntity(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.entityPaneList}>
                    {memberIds.length === 0 ? (
                      <div className={styles.emptyList}>No entities added yet.</div>
                    ) : (
                      memberIds.map(entityId => {
                        const entity = entityById.get(entityId);
                        const labels = changedLabels[entityId] ?? [];
                        return (
                          <div
                            key={entityId}
                            className={`${styles.entityPaneRow} ${activeEntityId === entityId ? styles.entityPaneRowActive : ''}`}
                            onClick={() => setActiveEntityId(entityId)}
                          >
                            <button
                              type="button"
                              className={styles.entityPaneRowBody}
                              onClick={() => setActiveEntityId(entityId)}
                            >
                              <div className={styles.entityPaneRowName}>
                                {entity?.entity_name ?? entityId}
                              </div>
                              <div className={styles.entityPaneRowChanges}>
                                {labels.length > 0 ? labels.join(', ') : 'No changes yet'}
                              </div>
                            </button>
                            <button
                              type="button"
                              className={styles.entityPaneRowRemove}
                              aria-label={`Remove ${entity?.entity_name ?? entityId}`}
                              onClick={e => {
                                e.stopPropagation();
                                removeEntity(entityId);
                              }}
                            >
                              <TbX size={13} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className={styles.entityPaneFooter}>
                    <button
                      type="button"
                      className={styles.addEntityButton}
                      onClick={() => setIsAddingEntity(true)}
                    >
                      <TbPlus size={13} />
                      Add entity
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className={styles.editorPane}>
              {memberIds.length === 0 ? (
                <div className={styles.editorPaneEmpty}>
                  Add an entity on the left to describe its planned change.
                </div>
              ) : (
                memberIds.map(entityId => (
                  <MemberEditor
                    key={entityId}
                    workspaceId={workspaceId}
                    entityId={entityId}
                    isActive={activeEntityId === entityId}
                    schemas={schemas}
                    teams={teams}
                    lifecycleStates={lifecycleStates}
                    existingProposedState={
                      existingCase?.members.find(m => m.entity_id === entityId)?.proposed_state
                    }
                    onProposedStateChange={(id, proposedState) =>
                      setProposedStates(prev => ({ ...prev, [id]: proposedState }))
                    }
                    onChangedLabelsChange={(id, labels) =>
                      setChangedLabels(prev => ({ ...prev, [id]: labels }))
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};
