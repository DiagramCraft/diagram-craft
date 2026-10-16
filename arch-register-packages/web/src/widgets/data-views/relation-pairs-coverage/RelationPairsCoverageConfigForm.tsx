import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { RelationPairsSourceFields } from './RelationPairsSourceFields';
import { RelationPairsCoverageWidgetConfig } from './types';

export const RelationPairsCoverageConfigForm = ({
  config,
  onChange
}: {
  config: RelationPairsCoverageWidgetConfig;
  onChange: (config: RelationPairsCoverageWidgetConfig) => void;
}) => {
  const optionalText = (value: string) => (value.trim() === '' ? undefined : value);

  return (
    <>
      <RelationPairsSourceFields config={config} onChange={onChange} />
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          {(
            [
              ['consumerLabel', 'Consumer heading', 'Consumer'],
              ['hubLabel', 'Hub heading', config.hubSchemaName],
              ['providerLabel', 'Provider heading', 'Provider'],
              ['coverageLabel', 'Coverage heading', config.coverageRelationSchemaName]
            ] as const
          ).map(([key, label, placeholder]) => (
            <FormGrid.Row key={key} label={label}>
              <TextInput
                value={config[key] ?? ''}
                placeholder={placeholder}
                style={{ width: '100%' }}
                onChange={value => onChange({ ...config, [key]: optionalText(value ?? '') })}
              />
            </FormGrid.Row>
          ))}
        </FormGrid>
      </FormGroup>
    </>
  );
};
