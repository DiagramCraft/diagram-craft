import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationEndpoint } from '@arch-register/api-types/relationSchemaContract';
import { SchemaMultiSelect } from '../../components/SchemaMultiSelect';
import { setEndpointSchemaIds } from './relationSchemaSettingsHelpers';
import styles from './SchemaSettingsScreen.module.css';

export const RelationEndpointEditor = ({
  label,
  hint,
  endpoint,
  schemas,
  canEdit,
  onChange
}: {
  label: string;
  hint: string;
  endpoint: RelationEndpoint;
  schemas: EntitySchema[];
  canEdit: boolean;
  onChange: (endpoint: RelationEndpoint) => void;
}) => (
  <div>
    <div className={styles.formLabel}>{label}</div>
    <Checkbox
      label="Allow any entity type"
      value={endpoint.schemaIds === 'any'}
      disabled={!canEdit}
      onChange={value => onChange(setEndpointSchemaIds(endpoint, value ? 'any' : []))}
    />
    {endpoint.schemaIds !== 'any' && (
      <SchemaMultiSelect
        label=""
        hint={hint}
        schemas={schemas}
        selectedIds={endpoint.schemaIds}
        disabled={!canEdit}
        onChange={schemaIds => onChange(setEndpointSchemaIds(endpoint, schemaIds))}
      />
    )}
  </div>
);
