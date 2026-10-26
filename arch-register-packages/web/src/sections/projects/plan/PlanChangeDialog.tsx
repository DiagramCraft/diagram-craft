import { useEffect, useState } from 'react';
import { relationLabel } from '../../../lib/relationLabel';
import { TbPlus, TbX } from 'react-icons/tb';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { useRelations } from '../../../hooks/useRelations';
import { useProjectEntities } from '../../../hooks/useProjects';
import { useMilestones } from '../../../hooks/useMilestones';
import {
  useAddRelationChangeCaseMember,
  useChangeCase,
  useCreateChangeCase,
  useRemoveChangeCaseMember,
  useSaveChangeCaseDraft,
  useUpdateChangeCaseMember
} from '../../../hooks/useChangeCases';
import { AddEntityDialog } from '../../../dialogs/AddEntityDialog';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { LoadingState } from '../../../components/LoadingState';
import { EntityMemberEditor } from './EntityMemberEditor';
import { MemberPicker } from './MemberPicker';
import { RelationMemberEditor } from './RelationMemberEditor';
import { useChangeCaseDraftState } from './useChangeCaseDraftState';
import {
  buildReferenceOptions,
  draftIdFromKey,
  isDraftKey,
  isRelationKey,
  relationIdFromKey,
  relationKey
} from './planChangeDraft';
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

type FormInit = {
  memberKeys: string[];
  name: string;
  targetDate: string;
  milestoneId: string;
  commitMessage: string;
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
  const { data: allRelations = [] } = useRelations(workspaceId, {}, { enabled: open });
  const createChangeCase = useCreateChangeCase(workspaceId, projectId);
  const addRelationMember = useAddRelationChangeCaseMember(workspaceId, projectId);
  const updateMember = useUpdateChangeCaseMember(workspaceId, projectId);
  const removeMember = useRemoveChangeCaseMember(workspaceId, projectId);
  const saveChangeCaseDraft = useSaveChangeCaseDraft(workspaceId, projectId);

  const draft = useChangeCaseDraftState({ schemas, projectId });
  const { memberKeys, activeKey, draftEntities } = draft;
  const [picker, setPicker] = useState<'entity' | 'relation' | null>(null);
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const resetForm = (init: FormInit) => {
    draft.reset(init.memberKeys);
    setPicker(null);
    setIsCreatingEntity(false);
    setName(init.name);
    setTargetDate(init.targetDate);
    setMilestoneId(init.milestoneId);
    setCommitMessage(init.commitMessage);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetForm only calls state setters
  useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }
    if (isEditing) return; // wait for existingCase to load, handled below
    resetForm({
      memberKeys: initialEntityId ? [initialEntityId] : [],
      name: '',
      targetDate: '',
      milestoneId: '',
      commitMessage: ''
    });
  }, [open, isEditing, initialEntityId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetForm only calls state setters
  useEffect(() => {
    if (!open || !isEditing || !existingCase || initialized) return;
    resetForm({
      memberKeys: existingCase.members.map(m =>
        m.kind === 'relation' ? relationKey(m.entity_id) : m.entity_id
      ),
      name: existingCase.name ?? '',
      targetDate: existingCase.target_date ?? '',
      milestoneId: existingCase.milestone_id ?? '',
      commitMessage: existingCase.commit_message ?? ''
    });
    setInitialized(true);
  }, [open, isEditing, existingCase, initialized]);

  const entityById = new Map(projectEntities.map(e => [e.entity_id, e]));
  const referenceOptionsExtra = buildReferenceOptions(
    projectEntities,
    Object.values(draftEntities),
    projectId
  );
  const candidateEntities = projectEntities
    .filter(e => !memberKeys.includes(e.entity_id))
    .map(e => ({
      key: e.entity_id,
      label: e.entity_name,
      searchText: `${e.entity_name} ${e.entity_slug}`
    }));

  const relationById = new Map(allRelations.map(r => [r._uid, r]));
  const relationLabelById = (relationId: string) => {
    const relation = relationById.get(relationId);
    return relation ? relationLabel(relation) : relationId;
  };
  const candidateRelations = allRelations
    .filter(r => !memberKeys.includes(relationKey(r._uid)))
    .map(r => ({
      key: relationKey(r._uid),
      label: `${relationLabel(r)} (${r._schema.name})`,
      searchText: `${relationLabel(r)} ${r._schema.name}`
    }));

  const memberLabel = (memberKey: string) => {
    if (isRelationKey(memberKey)) return relationLabelById(relationIdFromKey(memberKey));
    if (isDraftKey(memberKey)) {
      return draftEntities[draftIdFromKey(memberKey)]?.entity._name ?? memberKey;
    }
    return entityById.get(memberKey)?.entity_name ?? memberKey;
  };

  const addPickedMember = (key: string) => {
    draft.addMember(key);
    setPicker(null);
  };

  const handleTargetDateChange = (value: string) => {
    setTargetDate(value);
    if (value) setMilestoneId('');
  };

  const handleMilestoneChange = (value: string) => {
    setMilestoneId(value);
    if (value) setTargetDate('');
  };

  const allStatesReady = memberKeys.every(key => draft.proposedStates[key] !== undefined);
  const canSave =
    !isSaving &&
    allStatesReady &&
    // The create/saveDraft endpoints require at least one entity member; relations ride along.
    memberKeys.some(key => !isRelationKey(key)) &&
    name.trim().length > 0 &&
    (!isEditing || !!existingCase);

  const handleSubmit = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const entityKeys = memberKeys.filter(key => !isRelationKey(key));
      const relationKeys = memberKeys.filter(isRelationKey);
      const members = entityKeys.map(memberKey =>
        isDraftKey(memberKey)
          ? {
              draftId: draftIdFromKey(memberKey),
              proposedState: draft.proposedStates[memberKey]!
            }
          : { entityId: memberKey, proposedState: draft.proposedStates[memberKey]! }
      );
      const casePayload = {
        name,
        targetDate: milestoneId ? null : targetDate || null,
        milestoneId: milestoneId || null,
        commitMessage: commitMessage || null,
        members,
        newEntities: Object.values(draftEntities).map(d => ({ draftId: d.draftId, state: d.state }))
      };
      let caseId: string;
      if (isEditing) {
        caseId = editCaseId!;
        await saveChangeCaseDraft.mutateAsync({ caseId, draft: casePayload });
      } else {
        caseId = (await createChangeCase.mutateAsync(casePayload)).id;
      }

      // Relation members are managed through their own endpoints; saveDraft leaves them alone.
      const existingRelationMembers = new Map(
        (existingCase?.members ?? [])
          .filter(m => m.kind === 'relation')
          .map(m => [relationKey(m.entity_id), m])
      );
      for (const [key, member] of existingRelationMembers) {
        if (!relationKeys.includes(key)) {
          await removeMember.mutateAsync({ caseId, memberId: member.id });
        }
      }
      for (const key of relationKeys) {
        const proposedState = draft.proposedStates[key]!;
        const existing = existingRelationMembers.get(key);
        if (existing) {
          await updateMember.mutateAsync({ caseId, memberId: existing.id, proposedState });
        } else {
          await addRelationMember.mutateAsync({
            caseId,
            relationId: relationIdFromKey(key),
            proposedState
          });
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
            <FormElement label="Note" required={false}>
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
              {picker === 'relation' ? (
                <MemberPicker
                  items={candidateRelations}
                  searchPlaceholder="Search relations…"
                  emptyText="No matching relations."
                  onPick={addPickedMember}
                  onCancel={() => setPicker(null)}
                />
              ) : picker === 'entity' ? (
                <MemberPicker
                  items={candidateEntities}
                  searchPlaceholder="Search entities…"
                  emptyText="No matching entities."
                  onPick={addPickedMember}
                  onCancel={() => setPicker(null)}
                />
              ) : (
                <>
                  <div className={styles.entityPaneList}>
                    {memberKeys.length === 0 ? (
                      <div className={styles.emptyList}>No entities or relations added yet.</div>
                    ) : (
                      memberKeys.map(memberKey => {
                        const labels = draft.changedLabels[memberKey] ?? [];
                        const displayName = memberLabel(memberKey);
                        return (
                          <div
                            key={memberKey}
                            className={`${styles.entityPaneRow} ${activeKey === memberKey ? styles.entityPaneRowActive : ''}`}
                            onClick={() => draft.setActiveKey(memberKey)}
                          >
                            <button
                              type="button"
                              className={styles.entityPaneRowBody}
                              onClick={() => draft.setActiveKey(memberKey)}
                            >
                              <div className={styles.entityPaneRowName}>{displayName}</div>
                              <div className={styles.entityPaneRowChanges}>
                                {labels.length > 0 ? labels.join(', ') : 'No changes yet'}
                              </div>
                            </button>
                            <button
                              type="button"
                              className={styles.entityPaneRowRemove}
                              aria-label={`Remove ${displayName}`}
                              onClick={e => {
                                e.stopPropagation();
                                draft.removeMember(memberKey);
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
                      onClick={() => setPicker('entity')}
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
                    <button
                      type="button"
                      className={styles.addEntityButton}
                      onClick={() => setPicker('relation')}
                    >
                      <TbPlus size={13} />
                      Add relation
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className={styles.editorPane}>
              {memberKeys.length === 0 ? (
                <div className={styles.editorPaneEmpty}>
                  Add an entity on the left to describe its planned change.
                </div>
              ) : (
                memberKeys.map(memberKey => {
                  if (isRelationKey(memberKey)) {
                    return (
                      <RelationMemberEditor
                        key={memberKey}
                        workspaceId={workspaceId}
                        memberKey={memberKey}
                        relationId={relationIdFromKey(memberKey)}
                        isActive={activeKey === memberKey}
                        existingProposedState={
                          existingCase?.members.find(
                            m =>
                              m.kind === 'relation' && m.entity_id === relationIdFromKey(memberKey)
                          )?.proposed_state
                        }
                        onProposedStateChange={draft.setProposedState}
                        onChangedLabelsChange={draft.setChangedLabels}
                      />
                    );
                  }
                  const draftEntity = isDraftKey(memberKey)
                    ? draftEntities[draftIdFromKey(memberKey)]
                    : undefined;
                  return (
                    <EntityMemberEditor
                      key={memberKey}
                      workspaceId={workspaceId}
                      projectId={projectId}
                      memberKey={memberKey}
                      entityId={draftEntity ? '' : memberKey}
                      draftEntity={draftEntity?.entity}
                      isActive={activeKey === memberKey}
                      schemas={schemas}
                      teams={teams}
                      lifecycleStates={lifecycleStates}
                      existingProposedState={
                        draftEntity?.state ??
                        existingCase?.members.find(m => m.entity_id === memberKey)?.proposed_state
                      }
                      onProposedStateChange={draft.setProposedState}
                      onChangedLabelsChange={draft.setChangedLabels}
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
        draftMode
        onDraftCreated={state => {
          draft.addDraftEntity(state);
          setIsCreatingEntity(false);
        }}
        referenceOptionsExtra={referenceOptionsExtra}
        workspaceId={workspaceId}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        teams={teams}
      />
    </Dialog>
  );
};
