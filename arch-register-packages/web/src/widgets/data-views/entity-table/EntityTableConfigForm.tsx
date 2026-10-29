import { Select } from '@diagram-craft/app-components/Select';
import { EntityFilterPanel } from '../../../components/EntityFilterPanel';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import type { EntityTableWidgetConfig } from './types';

export const LIMIT_OPTIONS = [
  { value: '10', label: '10 rows' },
  { value: '20', label: '20 rows' },
  { value: '50', label: '50 rows' }
];

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: EntityTableWidgetConfig;
  onChange: (config: EntityTableWidgetConfig) => void;
};

export const EntityTableConfigForm = ({ config, onChange }: Props) => {
  const filter = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
  };
  const limit = String(config.limit ?? 10);

  return (
    <>
      <FormGroup label="Filters" supplementaryLabel="(optional)" variant="simple">
        <EntityFilterPanel
          value={filter}
          onChange={update => {
            const next = { ...filter, ...update };
            onChange({
              ...config,
              schema: optionalText(next.schemaId),
              owner: optionalText(next.owner),
              lifecycle: optionalText(next.lifecycle)
            });
          }}
        />
      </FormGroup>
      <FormGroup label="Options" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Limit">
            <Select.Root
              value={limit}
              onChange={value => onChange({ ...config, limit: Number(value ?? '10') })}
            >
              {LIMIT_OPTIONS.map(option => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Root>
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
