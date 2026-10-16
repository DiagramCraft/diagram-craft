import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import type { RelationPairsSourceConfig } from './types';

/** The hub, provider, consumer and coverage-relation pickers shared by both pair widgets. */
export const RelationPairsSourceFields = <T extends RelationPairsSourceConfig>({
  config,
  onChange
}: {
  config: T;
  onChange: (config: T) => void;
}) => {
  const { schemas, relationSchemas } = useWorkspaceContext();
  const hub = schemas.find(candidate => candidate.name === config.hubSchemaName);
  const relationFields = hub?.fields.filter(field => field.type === 'typedRelation') ?? [];

  const fieldSelect = (value: string, onValue: (value: string) => void) => (
    <Select.Root value={value} onChange={v => onValue(v ?? '')}>
      <Select.Item value="">Select a relation field…</Select.Item>
      {relationFields.map(field => (
        <Select.Item key={field.id} value={field.name}>
          {field.name}
        </Select.Item>
      ))}
    </Select.Root>
  );

  return (
    <>
      <FormGroup label="Hub entity type" variant="simple">
        <Select.Root
          value={config.hubSchemaName}
          onChange={value =>
            onChange({
              ...config,
              hubSchemaName: value ?? '',
              providerFieldName: '',
              consumerFieldName: ''
            })
          }
        >
          <Select.Item value="">Select an entity type…</Select.Item>
          {schemas.map(candidate => (
            <Select.Item key={candidate.id} value={candidate.name}>
              {candidate.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Providers" variant="simple">
        {fieldSelect(config.providerFieldName, value =>
          onChange({ ...config, providerFieldName: value })
        )}
      </FormGroup>
      <FormGroup label="Consumers" variant="simple">
        {fieldSelect(config.consumerFieldName, value =>
          onChange({ ...config, consumerFieldName: value })
        )}
      </FormGroup>
      <FormGroup label="Coverage relation type" variant="simple">
        <Select.Root
          value={config.coverageRelationSchemaName}
          onChange={value => onChange({ ...config, coverageRelationSchemaName: value ?? '' })}
        >
          <Select.Item value="">Select a relation type…</Select.Item>
          {relationSchemas.map(candidate => (
            <Select.Item key={candidate.id} value={candidate.name}>
              {candidate.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
    </>
  );
};
