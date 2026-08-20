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
  useSaveChangeCaseDraft
} from '../../../hooks/useChangeCases';
import { AddEntityDialog } from '../../../dialogs/AddEntityDialog';
import { createEntityEditState, type EntityEditState } from '../../../lib/entityEditState';
import { buildProposedState } from '../../../lib/entityProposedStateBuilder';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { isRelationLikeField } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import { LoadingState } from '../../../components/LoadingState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { EntityProposedStateFields } from './EntityProposedStateFields';
import {
  AffectedObjectivesMemberLine,
  AffectedObjectivesSummary,
  useAffectedObjectives
} from './AffectedObjectivesPanel';
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

type DraftEntity = {
  draftId: string;
  state: Record<string, unknown>;
  entity: EntityRecord;
};

const draftKey = (draftId: string) => `draft:${draftId}`;
const isDraftKey = (key: string) => key.startsWith('draft:');
const draftIdFromKey = (key: string) => key.slice('draft:'.length);

const isReferenceField = (f: EntitySchema['fields'][number]) => isRelationLikeField(f);

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
  check('Owner', (entity['_owner'] as { id: string } | null)?.id ?? '', planState['_owner'] ?? '');
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
  projectId: string;
  memberKey: string;
  entityId: string;
  draftEntity?: EntityRecord;
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
  projectId,
  memberKey,
  entityId,
  draftEntity,
  isActive,
  schemas,
  teams,
  lifecycleStates,
  existingProposedState,
  onProposedStateChange,
  onChangedLabelsChange
}: MemberEditorProps) => {
  const { data: loadedEntity } = useEntity(workspaceId, draftEntity ? '' : entityId);
  const entity = draftEntity ?? loadedEntity;
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
    const proposedState = buildProposedState(entity, schema, planState, existingProposedState);
    if (entity._projectId === projectId) proposedState.project_id = null;
    onProposedStateChange(memberKey, proposedState);
    onChangedLabelsChange(memberKey, computeChangedLabels(entity, schema, planState));
  }, [entity, schema, planState, memberKey, projectId]);

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
  const { relationSchemas } = useWorkspaceContext();
  const { data: projectEntities = [] } = useProjectEntities(workspaceId, projectId);
  const { data: milestones = [] } = useMilestones(workspaceId, projectId, open);
  const { data: existingCase } = useChangeCase(
    workspaceId,
    projectId,
    editCaseId ?? '',
    open && isEditing
  );
  const createChangeCase = useCreateChangeCase(workspaceId, projectId);
  const saveChangeCaseDraft = useSaveChangeCaseDraft(workspaceId, projectId);

  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [proposedStates, setProposedStates] = useState<Record<string, Record<string, unknown>>>({});
  const [changedLabels, setChangedLabels] = useState<Record<string, string[]>>({});
  const [draftEntities, setDraftEntities] = useState<Record<string, DraftEntity>>({});
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [addEntitySearch, setAddEntitySearch] = useState('');
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const addEntitySearchRef = useRef<HTMLInputElement>(null);
  useAutoFocus(addEntitySearchRef, { enabled: isAddingEntity, delay: 40 });
  const affectedObjectives = useAffectedObjectives({
    workspaceId,
    memberKeys: memberIds,
    relationSchemas,
    enabled: open
  });

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
    setIsCreatingEntity(false);
    setAddEntitySearch('');
    setDraftEntities({});
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
    setIsCreatingEntity(false);
    setAddEntitySearch('');
    setDraftEntities({});
    setProposedStates({});
    setChangedLabels({});
    setName(existingCase.name ?? '');
    setTargetDate(existingCase.target_date ?? '');
    setMilestoneId(existingCase.milestone_id ?? '');
    setCommitMessage(existingCase.commit_message ?? '');
    setInitialized(true);
  }, [open, isEditing, existingCase, initialized]);

  const entityById = new Map(projectEntities.map(e => [e.entity_id, e]));
  const referenceOptionsExtra = Object.fromEntries(
    [
      ...projectEntities.map(entity => ({
        entity_id: entity.entity_id,
        entity_name: entity.entity_name,
        entity_slug: entity.entity_slug,
        entity_schema_id: entity.entity_schema?.id ?? null,
        entity_schema_name: entity.entity_schema?.name ?? null
      })),
      ...Object.values(draftEntities).map(draft => ({
        entity_id: draft.draftId,
        entity_name: draft.entity._name,
        entity_slug: draft.entity._slug,
        entity_schema_id: draft.entity._schema.id,
        entity_schema_name: draft.entity._schema.name
      }))
    ].reduce(
      (entries, entity) => {
        const schemaId = entity.entity_schema_id;
        if (!schemaId) return entries;
        const summary = {
          _uid: entity.entity_id,
          _publicId: entity.entity_id,
          _schema: { id: schemaId, name: entity.entity_schema_name ?? schemaId },
          _name: entity.entity_name,
          _slug: entity.entity_slug,
          _namespace: 'default',
          _description: '',
          _owner: null,
          _lifecycle: null,
          _targetLifecycle: null,
          _targetLifecycleDate: null,
          _tags: [],
          _links: [],
          _projectId: projectId,
          _completeness: null
        } as unknown as EntitySummary;
        entries.set(schemaId, [...(entries.get(schemaId) ?? []), summary]);
        return entries;
      },
      new Map<string, EntitySummary[]>() as Map<string, EntitySummary[]>
    )
  );
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

  const addDraftEntity = (state: Record<string, unknown>) => {
    const id = globalThis.crypto.randomUUID();
    const schemaId = String(state['schema_id']);
    const schema = schemas.find(item => item.id === schemaId);
    const entity = {
      _uid: id,
      _publicId: id,
      _schema: { id: schemaId, name: schema?.name ?? schemaId },
      _name: String(state['name'] ?? ''),
      _slug: String(state['slug'] ?? ''),
      _namespace: String(state['namespace'] ?? 'default'),
      _description: String(state['description'] ?? ''),
      _owner: state['owner'] ? { id: String(state['owner']), name: String(state['owner']) } : null,
      _lifecycle: state['lifecycle']
        ? { id: String(state['lifecycle']), name: String(state['lifecycle']) }
        : null,
      _targetLifecycle: state['target_lifecycle']
        ? { id: String(state['target_lifecycle']), name: String(state['target_lifecycle']) }
        : null,
      _targetLifecycleDate: (state['target_lifecycle_date'] as string | null) ?? null,
      _tags: Array.isArray(state['tags'])
        ? state['tags'].filter((v): v is string => typeof v === 'string')
        : [],
      _links: Array.isArray(state['links']) ? state['links'] : [],
      _updatedAt: new Date().toISOString(),
      _version: 1,
      _projectId: projectId,
      _completeness: null,
      ...(state['data'] as Record<string, unknown>)
    } as unknown as EntityRecord;
    const draft = { draftId: id, state, entity };
    setDraftEntities(prev => ({ ...prev, [id]: draft }));
    const key = draftKey(id);
    setMemberIds(prev => [...prev, key]);
    setActiveEntityId(key);
    setIsCreatingEntity(false);
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
    if (isDraftKey(entityId)) {
      const id = draftIdFromKey(entityId);
      setDraftEntities(prev => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
    }
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
      const members = memberIds.map(memberKey =>
        isDraftKey(memberKey)
          ? {
              draftId: draftIdFromKey(memberKey),
              proposedState: proposedStates[memberKey]!
            }
          : { entityId: memberKey, proposedState: proposedStates[memberKey]! }
      );
      const newEntities = Object.values(draftEntities).map(draft => ({
        draftId: draft.draftId,
        state: draft.state
      }));
      if (!isEditing) {
        await createChangeCase.mutateAsync({
          name,
          targetDate: milestoneId ? null : targetDate || null,
          milestoneId: milestoneId || null,
          commitMessage: commitMessage || null,
          members,
          newEntities
        });
      } else {
        const caseId = editCaseId!;
        await saveChangeCaseDraft.mutateAsync({
          caseId,
          draft: {
            name,
            targetDate: milestoneId ? null : targetDate || null,
            milestoneId: milestoneId || null,
            commitMessage: commitMessage || null,
            members,
            newEntities
          }
        });
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
            <AffectedObjectivesSummary state={affectedObjectives} />
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
                      memberIds.map(memberKey => {
                        const draft = isDraftKey(memberKey)
                          ? draftEntities[draftIdFromKey(memberKey)]
                          : undefined;
                        const entity = draft?.entity ?? entityById.get(memberKey);
                        const labels = changedLabels[memberKey] ?? [];
                        return (
                          <div
                            key={memberKey}
                            className={`${styles.entityPaneRow} ${activeEntityId === memberKey ? styles.entityPaneRowActive : ''}`}
                            onClick={() => setActiveEntityId(memberKey)}
                          >
                            <button
                              type="button"
                              className={styles.entityPaneRowBody}
                              onClick={() => setActiveEntityId(memberKey)}
                            >
                              <div className={styles.entityPaneRowName}>
                                {(entity as { entity_name?: string; _name?: string } | undefined)
                                  ?.entity_name ??
                                  (entity as { _name?: string } | undefined)?._name ??
                                  memberKey}
                              </div>
                              <div className={styles.entityPaneRowChanges}>
                                {labels.length > 0 ? labels.join(', ') : 'No changes yet'}
                              </div>
                              <AffectedObjectivesMemberLine
                                state={affectedObjectives}
                                memberKey={memberKey}
                                isDraft={isDraftKey(memberKey)}
                              />
                            </button>
                            <button
                              type="button"
                              className={styles.entityPaneRowRemove}
                              aria-label={`Remove ${
                                (entity as { entity_name?: string; _name?: string } | undefined)
                                  ?.entity_name ??
                                (entity as { _name?: string } | undefined)?._name ??
                                memberKey
                              }`}
                              onClick={e => {
                                e.stopPropagation();
                                removeEntity(memberKey);
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
                    <button
                      type="button"
                      className={styles.addEntityButton}
                      onClick={() => setIsCreatingEntity(true)}
                    >
                      <TbPlus size={13} />
                      New entity
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
                memberIds.map(memberKey => {
                  const draft = isDraftKey(memberKey)
                    ? draftEntities[draftIdFromKey(memberKey)]
                    : undefined;
                  const entityId = draft ? '' : memberKey;
                  return (
                    <MemberEditor
                      key={memberKey}
                      workspaceId={workspaceId}
                      projectId={projectId}
                      memberKey={memberKey}
                      entityId={entityId}
                      draftEntity={draft?.entity}
                      isActive={activeEntityId === memberKey}
                      schemas={schemas}
                      teams={teams}
                      lifecycleStates={lifecycleStates}
                      existingProposedState={
                        draft?.state ??
                        existingCase?.members.find(m => m.entity_id === memberKey)?.proposed_state
                      }
                      onProposedStateChange={(id, proposedState) =>
                        setProposedStates(prev => ({ ...prev, [id]: proposedState }))
                      }
                      onChangedLabelsChange={(id, labels) =>
                        setChangedLabels(prev => ({ ...prev, [id]: labels }))
                      }
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      <AddEntityDialog
        open={isCreatingEntity}
        onClose={() => setIsCreatingEntity(false)}
        onCreated={() => undefined}
        draftMode
        onDraftCreated={addDraftEntity}
        referenceOptionsExtra={referenceOptionsExtra}
        workspaceId={workspaceId}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        teams={teams}
      />
    </Dialog>
  );
};
