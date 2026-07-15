import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useEntity } from '../../../hooks/useEntities';
import { useCreateFutureUpdate } from '../../../hooks/useSnapshots';
import { createEntityEditState, type EntityEditState } from '../../../lib/entityEditState';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import styles from './PlanFutureChangeDialog.module.css';
import { LoadingState } from '../../../components/LoadingState';

type Props = {
  open: boolean;
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

  const schema = entity ? (schemas.find(s => s.id === entity._schema.id) ?? null) : null;

  const [targetDate, setTargetDate] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [planState, setPlanState] = useState<EntityEditState>({});

  useEffect(() => {
    if (!open) return;
    setTargetDate('');
    setCommitMessage('');
    if (!entity || !schema) {
      setPlanState({});
      return;
    }
    setPlanState(createEntityEditState(entity, schema));
  }, [open, entity, schema]);

  const handleSave = () => {
    if (!entity || !schema) return;

    const customData: Record<string, unknown> = {};
    for (const f of schema.fields) {
      customData[f.id] = planState[f.id] ?? '';
    }

    const proposedState: Record<string, unknown> = {
      name: (planState['_name'] as string) ?? entity._name,
      slug: entity._slug,
      namespace: entity._namespace,
      description: (planState['_description'] as string) ?? entity._description,
      owner: (planState['_owner'] as string) || null,
      lifecycle: (planState['_lifecycle'] as string) || null,
      target_lifecycle: (planState['_targetLifecycle'] as string) || null,
      target_lifecycle_date: (planState['_targetLifecycleDate'] as string) || null,
      tags: entity._tags,
      links: entity._links,
      schema_id: entity._schema.id,
      data: customData,
      visibility_mode: entity._visibilityMode ?? null
    };

    createFutureUpdate.mutate(
      {
        projectId,
        targetDate: targetDate || null,
        commitMessage: commitMessage || null,
        proposedState
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Plan future change"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: createFutureUpdate.isPending ? 'Saving...' : 'Save plan',
          type: 'default',
          disabled: createFutureUpdate.isPending || !entity,
          onClick: handleSave
        }
      ]}
    >
      {!entity ? (
        <LoadingState text="Loading..." size="sm" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormElement label="Target date">
            <DateInput
              value={targetDate}
              onChange={v => setTargetDate(v ?? '')}
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Note" hint="Describe what is planned to change">
            <TextInput
              value={commitMessage}
              onChange={v => setCommitMessage(v ?? '')}
              placeholder="e.g. Decommission after migration (optional)"
              style={{ width: '100%' }}
            />
          </FormElement>

          <FormElement label="Name">
            <TextInput
              value={(planState['_name'] as string) ?? ''}
              onChange={v => setPlanState(s => ({ ...s, _name: v ?? '' }))}
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Description">
            <TextInput
              value={(planState['_description'] as string) ?? ''}
              onChange={v => setPlanState(s => ({ ...s, _description: v ?? '' }))}
              style={{ width: '100%' }}
            />
          </FormElement>
          <FormElement label="Owner">
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
          <FormElement label="Lifecycle">
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
              <FormElement key={f.id} label={f.name}>
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
