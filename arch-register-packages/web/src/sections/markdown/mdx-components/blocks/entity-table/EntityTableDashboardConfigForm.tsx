import { EntityTableConfigForm } from './EntityTableConfigForm';
import type { EntityTableFilterState, EntityTableWidgetConfig } from './types';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: EntityTableWidgetConfig;
  onChange: (config: EntityTableWidgetConfig) => void;
};

export const EntityTableDashboardConfigForm = ({ config, onChange }: Props) => {
  const value: EntityTableFilterState = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? '',
    limit: String(config.limit ?? '10')
  };

  return (
    <EntityTableConfigForm
      value={value}
      onChange={update => {
        const next = { ...value, ...update };
        onChange({
          schema: optionalText(next.schemaId),
          owner: optionalText(next.owner),
          lifecycle: optionalText(next.lifecycle),
          limit: Number(next.limit)
        });
      }}
    />
  );
};
