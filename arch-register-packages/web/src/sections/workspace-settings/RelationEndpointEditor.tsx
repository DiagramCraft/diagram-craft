import { MultiSelect } from '@diagram-craft/app-components/MultiSelect';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCanEditSchemas } from './schemaEditorContext';
import type { RelationEndpoint } from '@arch-register/api-types/relationSchemaContract';
import { setEndpointSchemaIds } from './relationSchemaSettingsHelpers';
import styles from './SchemaSettingsScreen.module.css';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';

export const RelationEndpointEditor = ({
  label,
  endpoint,
  onChange
}: {
  label: string;
  endpoint: RelationEndpoint;
  onChange: (endpoint: RelationEndpoint) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  const canEdit = useCanEditSchemas();

  return (
    <div style={{ fontSize: '12px', marginBottom: '8px' }}>
      <div className={styles.formLabel}>{label}</div>
      <TextInput
        value={endpoint.label ?? ''}
        disabled={!canEdit}
        placeholder="Contextual label"
        onChange={value => {
          const trimmed = value?.trim() ?? '';
          onChange({ ...endpoint, label: trimmed === '' ? undefined : trimmed });
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
        <ToggleButtonGroup.Root
          type="single"
          value={endpoint.schemaIds === 'any' ? 'any' : 'select'}
          onChange={value => {
            if (value) onChange(setEndpointSchemaIds(endpoint, value === 'any' ? 'any' : []));
          }}
        >
          <ToggleButtonGroup.Item value="any">Any</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="select">Select</ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>

        {endpoint.schemaIds !== 'any' && (
          <MultiSelect
            selectedValues={endpoint.schemaIds}
            availableItems={[
              ...schemas.map(schema => ({ value: schema.id, label: schema.name })),
              // Keep selections whose schema no longer exists visible and removable
              ...endpoint.schemaIds
                .filter(id => !schemas.some(schema => schema.id === id))
                .map(id => ({ value: id, label: 'Unavailable type' }))
            ]}
            maxSuggestions={schemas.length}
            onSelectionChange={schemaIds => onChange(setEndpointSchemaIds(endpoint, schemaIds))}
            placeholder="Select entity types..."
            disabled={!canEdit}
            style={{ width: '100%' }}
          />
        )}
      </div>
    </div>
  );
};
