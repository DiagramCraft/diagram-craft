import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { isRelationLikeField } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { EntityFieldInput } from '../../../dialogs/EntityFieldInput';
import { useSupportedCurrencies } from '../../../hooks/useWorkspaceConfig';
import { isMultiValuedScalarField } from '../../../lib/scalarFieldValues';
import type { EntityEditState } from '../../../lib/entityEditState';

type Field = EntitySchema['fields'][number];

// The plan state keeps booleans as real booleans (as stored on the entity), while
// EntityFieldInput edits single-valued booleans and numbers as strings.
const toInputValue = (field: Field, value: unknown): unknown => {
  if (isMultiValuedScalarField(field)) return value;
  if (field.type === 'boolean') return typeof value === 'boolean' ? String(value) : '';
  if (field.type === 'number') return typeof value === 'number' ? String(value) : (value ?? '');
  if (field.type === 'currency' || field.type === 'principal') return value;
  return value ?? '';
};

const fromInputValue = (field: Field, value: unknown): unknown => {
  if (isMultiValuedScalarField(field)) return value;
  if (field.type === 'boolean') return value === 'true' ? true : value === 'false' ? false : '';
  return value;
};

type Props = {
  workspaceId: string;
  schema: EntitySchema | null;
  planState: EntityEditState;
  setPlanState: (updater: (state: EntityEditState) => EntityEditState) => void;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
};

export const EntityProposedStateFields = ({
  workspaceId,
  schema,
  planState,
  setPlanState,
  teams,
  lifecycleStates
}: Props) => {
  const currencyConfig = useSupportedCurrencies(workspaceId, true);

  return (
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
        <Select.Root
          value={(planState['_owner'] as string) ?? ''}
          onChange={v => setPlanState(s => ({ ...s, _owner: v ?? '' }))}
          placeholder="—"
          style={{ width: '100%' }}
        >
          <Select.Item value="">—</Select.Item>
          {teams.map(t => (
            <Select.Item key={t.id} value={t.id}>
              {t.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      <FormElement label="Lifecycle" required={false}>
        <Select.Root
          value={(planState['_lifecycle'] as string) ?? ''}
          onChange={v => setPlanState(s => ({ ...s, _lifecycle: v ?? '' }))}
          placeholder="—"
          style={{ width: '100%' }}
        >
          <Select.Item value="">—</Select.Item>
          {lifecycleStates.map(ls => (
            <Select.Item key={ls.id} value={ls.id}>
              {ls.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>

      {schema?.fields
        .filter(f => !isRelationLikeField(f) && f.type !== 'derived')
        .map(f => (
          <EntityFieldInput
            key={f.id}
            field={f}
            value={toInputValue(f, planState[f.id])}
            onChange={value => setPlanState(s => ({ ...s, [f.id]: fromInputValue(f, value) }))}
            currencyOptions={currencyConfig.data?.currencies}
            defaultCurrency={currencyConfig.data?.default_currency}
          />
        ))}
    </>
  );
};
