import { TbArrowBackUp } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '../../../lib/api';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
import type { BulkEditableField } from './bulkEditFields';
import styles from './BulkEditToolbar.module.css';

export type BulkFieldInputProps = {
  workspaceId: string;
  field: BulkEditableField;
  value: string;
  clearing: boolean;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  onValue: (value: string) => void;
  onClearing: (clearing: boolean) => void;
};

export const BulkFieldInput = ({
  workspaceId,
  field,
  value,
  clearing,
  teams,
  lifecycleStates,
  onValue,
  onClearing
}: BulkFieldInputProps) => {
  const referenceSchemaId =
    field.kind === 'schema' && field.field.type === 'reference' ? field.field.schemaId : undefined;
  const referenceQueries = useEntitiesBySchema(workspaceId, referenceSchemaId ? [referenceSchemaId] : []);
  const referenceCandidates = referenceQueries[0]?.data ?? [];

  if (clearing) {
    return (
      <span className={styles.bulkClearingTag}>
        will clear
        <button
          type="button"
          className={styles.bulkUnclear}
          title="Undo"
          onClick={() => onClearing(false)}
        >
          <TbArrowBackUp size={11} />
        </button>
      </span>
    );
  }

  if (field.kind === 'owner') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        {teams.map(team => (
          <Select.Item key={team.id} value={team.id}>
            {team.name}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }

  if (field.kind === 'lifecycle') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        {lifecycleStates.map(state => (
          <Select.Item key={state.id} value={state.id}>
            {state.label}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }

  const schemaField = field.field;

  if (schemaField.type === 'select') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        {schemaField.options.map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }

  if (schemaField.type === 'reference') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        {referenceCandidates.map(entity => (
          <Select.Item key={entity._uid} value={entity._uid}>
            {entity._name || entity._slug}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }

  if (schemaField.type === 'boolean') {
    return (
      <Select.Root value={value} placeholder="No change" onChange={v => onValue(v ?? '')}>
        <Select.Item value="true">Yes</Select.Item>
        <Select.Item value="false">No</Select.Item>
      </Select.Root>
    );
  }

  if (schemaField.type === 'date') {
    return <DateInput value={value} onChange={v => onValue(v ?? '')} />;
  }

  if (schemaField.type === 'longtext') {
    return <TextArea value={value} onChange={v => onValue(v ?? '')} placeholder="New value…" />;
  }

  return <TextInput value={value} onChange={v => onValue(v ?? '')} placeholder="New value…" />;
};
