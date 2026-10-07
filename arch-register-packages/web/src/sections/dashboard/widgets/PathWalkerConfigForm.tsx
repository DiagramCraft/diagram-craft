import { useMemo } from 'react';
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { pathStepKey } from '../../entities/components/pathBuilder/pathBuilderState';
import { hopDirectionGlyph } from '../../entities/components/pathWalkerViewState';
import {
  findRootSchema,
  hopChainOptions,
  resolveWalkerHops,
  type PathWalkerWidgetConfig
} from './pathWalkerWidgetLogic';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
  config: PathWalkerWidgetConfig;
  onChange: (config: PathWalkerWidgetConfig) => void;
};

export const PathWalkerConfigForm = ({ config, onChange }: Props) => {
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
      <DialogSection label="Starting entity type" required>
        <select
          className={styles.labelInput}
          value={rootSchema?.name ?? ''}
          onChange={event =>
            onChange({ ...config, rootSchemaName: event.currentTarget.value, hops: [] })
          }
        >
          <option value="">Select an entity type…</option>
          {schemas.map(schema => (
            <option key={schema.id} value={schema.name}>
              {schema.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Relationship path" required={false}>
        {chain.map(({ options }, index) => {
          const current = hops[index];
          const currentKey = current ? pathStepKey(current) : '';
          return (
            <select
              key={index}
              className={styles.labelInput}
              aria-label={`Relation to follow from column ${index + 1}`}
              value={currentKey}
              onChange={event => {
                const option = options.find(o => pathStepKey(o.step) === event.currentTarget.value);
                setHops(option ? [...hops.slice(0, index), option.step] : hops.slice(0, index));
              }}
            >
              <option value="">
                {index === 0 ? 'No relation (start unexpanded)' : 'Stop here'}
              </option>
              {options.map(option => (
                <option key={pathStepKey(option.step)} value={pathStepKey(option.step)}>
                  {hopDirectionGlyph(option.step)} {option.label}
                </option>
              ))}
            </select>
          );
        })}
      </DialogSection>
      <DialogSection label="Title" required={false}>
        <input
          type="text"
          className={styles.labelInput}
          value={config.label ?? ''}
          placeholder="Relationship walker"
          onChange={event =>
            onChange({ ...config, label: event.currentTarget.value.trim() || undefined })
          }
        />
      </DialogSection>
    </>
  );
};
