import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { EntityEditState } from '../../../lib/entityEditState';
import styles from './EntityProposedStateFields.module.css';

const isReference = (f: EntitySchema['fields'][number]) =>
  f.type === 'reference' || f.type === 'containment';

type Props = {
  schema: EntitySchema | null;
  planState: EntityEditState;
  setPlanState: (updater: (state: EntityEditState) => EntityEditState) => void;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
};

export const EntityProposedStateFields = ({
  schema,
  planState,
  setPlanState,
  teams,
  lifecycleStates
}: Props) => (
  <>
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
  </>
);
