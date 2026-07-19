import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import { useEntity } from '../../../hooks/useEntities';
import { useCreateFutureUpdate, useUpdateSnapshot } from '../../../hooks/useSnapshots';
import { useMilestones } from '../../../hooks/useMilestones';
import { createEntityEditState, type EntityEditState } from '../../../lib/entityEditState';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import styles from './PlanFutureChangeDialog.module.css';
import { LoadingState } from '../../../components/LoadingState';

type Props = {
  open: boolean;
  snapshot?: EntitySnapshot;
  workspaceId: string;
  projectId: string;
  entityId: string;
  schemas: EntitySchema[];
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  onClose: () => void;
};

const isReference = (f: EntitySchema['fields'][number]) =>
  f.type === 'reference' || f.type === 'containment';

export const PlanFutureChangeDialog = ({
  open,
  snapshot,
  workspaceId,
  projectId,
  entityId,
  schemas,
  teams,
  lifecycleStates,
  onClose
}: Props) => {
  const { data: entity } = useEntity(workspaceId, entityId);
  const createFutureUpdate = useCreateFutureUpdate(workspaceId, entityId);
  const updateSnapshot = useUpdateSnapshot(workspaceId, entityId);
  const { data: milestones = [] } = useMilestones(workspaceId, projectId, open);

  const schema = entity ? (schemas.find(s => s.id === entity._schema.id) ?? null) : null;
  const isEditing = snapshot != null;

  const [targetDate, setTargetDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [planState, setPlanState] = useState<EntityEditState>({});

  const handleTargetDateChange = (value: string) => {
    setTargetDate(value);
    if (value) setMilestoneId('');
  };

  const handleMilestoneChange = (value: string) => {
    setMilestoneId(value);
    if (value) setTargetDate('');
  };

  useEffect(() => {
    if (!open) return;
    setTargetDate(snapshot?.target_date ?? '');
    setMilestoneId(snapshot?.milestone_id ?? '');
    setCommitMessage(snapshot?.commit_message ?? '');
    if (!entity || !schema) {
      setPlanState({});
      return;
    }
    const state = createEntityEditState(entity, schema);
    if (snapshot) {
      const proposed = snapshot.proposed_state as Record<string, unknown> | null;
      const proposedData = (proposed?.data as Record<string, unknown> | undefined) ?? {};
      state._name = proposed?.name ?? state._name;
      state._slug = proposed?.slug ?? state._slug;
      state._namespace = proposed?.namespace ?? state._namespace;
      state._description = proposed?.description ?? state._description;
      state._owner = proposed?.owner ?? '';
      state._lifecycle = proposed?.lifecycle ?? '';
      state._targetLifecycle = proposed?.target_lifecycle ?? '';
      state._targetLifecycleDate = proposed?.target_lifecycle_date ?? '';
      state._tags = Array.isArray(proposed?.tags) ? proposed.tags.join(', ') : state._tags;
      for (const field of schema.fields) {
        state[field.id] = proposedData[field.id] ?? state[field.id];
      }
    }
    setPlanState(state);
  }, [open, entity, schema, snapshot]);

  const handleSave = () => {
    if (!entity || !schema) return;

    const customData: Record<string, unknown> = {};
    for (const f of schema.fields) {
      customData[f.id] = planState[f.id] ?? '';
    }

    const existingProposed = snapshot?.proposed_state as Record<string, unknown> | null;
    const proposedState: Record<string, unknown> = {
      name: (planState['_name'] as string) ?? entity._name,
      slug: existingProposed?.slug ?? entity._slug,
      namespace: existingProposed?.namespace ?? entity._namespace,
      description: (planState['_description'] as string) ?? entity._description,
      owner: (planState['_owner'] as string) ?? null,
      lifecycle: (planState['_lifecycle'] as string) ?? null,
      target_lifecycle: (planState['_targetLifecycle'] as string) ?? null,
      target_lifecycle_date: (planState['_targetLifecycleDate'] as string) ?? null,
      tags: existingProposed?.tags ?? entity._tags,
      links: existingProposed?.links ?? entity._links,
      schema_id: existingProposed?.schema_id ?? entity._schema.id,
      data: customData,
      visibility_mode: existingProposed?.visibility_mode ?? entity._visibilityMode ?? null
    };

    if (snapshot) {
      updateSnapshot.mutate(
        {
          snapshotId: snapshot.id,
          projectId,
          targetDate: milestoneId ? null : (targetDate ?? null),
          milestoneId: milestoneId ?? null,
          commitMessage: commitMessage ?? null,
          proposedState
        },
        { onSuccess: onClose }
      );
    } else {
      createFutureUpdate.mutate(
        {
          projectId,
          targetDate: milestoneId ? null : (targetDate ?? null),
          milestoneId: milestoneId ?? null,
          commitMessage: commitMessage ?? null,
          proposedState
        },
        { onSuccess: onClose }
      );
    }
  };

  const canSave = !!entity;
  const isSaving = createFutureUpdate.isPending || updateSnapshot.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit future change' : 'Plan future change'}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Save plan',
          type: 'default',
          disabled: isSaving || !canSave,
          onClick: handleSave
        }
      ]}
    >
      {!entity ? (
        <LoadingState text="Loading..." size="sm" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              {milestones.length === 0 && (
                <div className={styles.hint}>This project has no milestones yet.</div>
              )}
            </FormElement>
          </div>
          <FormElement label="Note" required={false} hint="Describe what is planned to change">
            <TextInput
              value={commitMessage}
              onChange={v => setCommitMessage(v ?? '')}
              placeholder="e.g. Decommission after migration"
              style={{ width: '100%' }}
            />
          </FormElement>

          <FormElement label="Name" required={false}>
            <TextInput
              value={(planState['_name'] as string) ?? ''}
              onChange={v => setPlanState(s => ({ ...s, _name: v ?? '' }))}
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Description" required={false}>
            <TextInput
              value={(planState['_description'] as string) ?? ''}
              onChange={v => setPlanState(s => ({ ...s, _description: v ?? '' }))}
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Owner" required={false}>
            <select
              className={styles.inlineSelect}
              value={(planState['_owner'] as string) ?? ''}
              onChange={e => setPlanState(s => ({ ...s, _owner: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="">—</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </FormElement>
          <FormElement label="Lifecycle" required={false}>
            <select
              className={styles.inlineSelect}
              value={(planState['_lifecycle'] as string) ?? ''}
              onChange={e => setPlanState(s => ({ ...s, _lifecycle: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="">—</option>
              {lifecycleStates.map(ls => (
                <option key={ls.id} value={ls.id}>
                  {ls.label}
                </option>
              ))}
            </select>
          </FormElement>

          {schema?.fields
            .filter(f => !isReference(f))
            .map(f => (
              <FormElement key={f.id} label={f.name} required={f.requirementLevel !== 'optional'}>
                {f.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={!!planState[f.id]}
                    onChange={e => setPlanState(s => ({ ...s, [f.id]: e.target.checked }))}
                  />
                ) : f.type === 'select' ? (
                  <select
                    className={styles.inlineSelect}
                    value={(planState[f.id] as string) ?? ''}
                    onChange={e => setPlanState(s => ({ ...s, [f.id]: e.target.value }))}
                    style={{ width: '100%' }}
                  >
                    <option value="">—</option>
                    {f.options.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TextInput
                    value={(planState[f.id] as string) ?? ''}
                    onChange={v => setPlanState(s => ({ ...s, [f.id]: v ?? '' }))}
                    style={{ width: '100%' }}
                  />
                )}
              </FormElement>
            ))}
        </div>
      )}
    </Dialog>
  );
};
