import { useMemo } from 'react';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { type PathStep } from '@arch-register/api-types/entityQueryIR';
import { Select } from '@diagram-craft/app-components/Select';
import { FormGroup } from '../../../components/FormGroup';
import { pathStepKey } from '../../../sections/entities/components/pathBuilder/pathBuilderState';
import { hopDirectionGlyph } from '../../../sections/entities/components/pathWalkerViewState';
import {
  findRootSchema,
  hopChainOptions,
  resolveWalkerHops,
  type PathWalkerWidgetConfig
} from './pathWalkerWidgetLogic';

type PathWalkerConfigFormProps = {
  config: PathWalkerWidgetConfig;
  onChange: (config: PathWalkerWidgetConfig) => void;
};

export const PathWalkerConfigForm = ({ config, onChange }: PathWalkerConfigFormProps) => {
  const { schemas, relationSchemas } = useWorkspaceContext();
  const rootSchema = findRootSchema(config, schemas);
  const hops = useMemo(() => resolveWalkerHops(config, relationSchemas), [config, relationSchemas]);
  const chain = useMemo(
    () =>
      rootSchema
        ? hopChainOptions({ rootSchemaId: rootSchema.id, hops, schemas, relationSchemas })
        : [],
    [rootSchema, hops, schemas, relationSchemas]
  );

  const setHops = (next: PathStep[]) => onChange({ ...config, hops: next });

  return (
    <>
      <FormGroup label="Starting entity type" variant="simple">
        <Select.Root
          value={rootSchema?.name ?? ''}
          onChange={value => onChange({ ...config, rootSchemaName: value ?? '', hops: [] })}
        >
          <Select.Item value="">Select an entity type…</Select.Item>
          {schemas.map(schema => (
            <Select.Item key={schema.id} value={schema.name}>
              {schema.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Relationship path" supplementaryLabel="(optional)" variant="simple">
        {chain.map(({ options }, index) => {
          const current = hops[index];
          const currentKey = current ? pathStepKey(current) : '';
          return (
            <Select.Root
              key={index}
              value={currentKey}
              onChange={value => {
                const option = options.find(o => pathStepKey(o.step) === value);
                setHops(option ? [...hops.slice(0, index), option.step] : hops.slice(0, index));
              }}
            >
              <Select.Item value="">
                {index === 0 ? 'No relation (start unexpanded)' : 'Stop here'}
              </Select.Item>
              {options.map(option => (
                <Select.Item key={pathStepKey(option.step)} value={pathStepKey(option.step)}>
                  {hopDirectionGlyph(option.step)} {option.label}
                </Select.Item>
              ))}
            </Select.Root>
          );
        })}
      </FormGroup>
    </>
  );
};
