import { useMemo } from 'react';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { PathWalkerView } from '../../entities/components/PathWalkerView';
import type { BrowserEntityRecord } from '../../entities/components/entityBrowserState';
import styles from './PathWalkerWidget.module.css';
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { pathStepKey } from '../../entities/components/pathBuilder/pathBuilderState';
import { hopDirectionGlyph } from '../../entities/components/pathWalkerViewState';
import { findRootSchema, hopChainOptions, resolveWalkerHops } from './pathWalkerWidgetLogic';
import configFormStyles from '../WidgetConfigDialog.module.css';
import { isPathWalkerConfigComplete, type PathWalkerWidgetConfig } from './pathWalkerWidgetLogic';

const FETCH_LIMIT = 1000;

/**
 * Generic multi-column relationship walker: lists every entity of one type and lets the viewer
 * follow a chain of relations column by column (selection and hop choices are local state, seeded
 * from the configured chain). Wraps `PathWalkerView`, the same view the `path-walker` saved-view
 * mode renders.
 */
export const PathWalkerWidget = ({ config }: { config: PathWalkerWidgetConfig }) => {
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const complete = isPathWalkerConfigComplete(config);
  const rootSchema = findRootSchema(config, schemas);

  const roots = useEntities(
    workspaceSlug,
    { schemaId: rootSchema?.id, view: 'summary', limit: FETCH_LIMIT },
    { enabled: !!workspaceSlug && complete && !!rootSchema }
  );

  const walkerConfig = useMemo(
    () => ({ hops: resolveWalkerHops(config, relationSchemas) }),
    [config, relationSchemas]
  );

  if (!complete || (!rootSchema && schemas.length > 0)) {
    return <div className={`${styles.message} dim`}>This widget is not fully configured.</div>;
  }

  return (
    <div className={styles.walker}>
      <PathWalkerView
        rows={roots.data as BrowserEntityRecord[]}
        schemas={schemas}
        relationSchemas={relationSchemas}
        workspaceId={workspaceSlug}
        config={walkerConfig}
        onEntityClick={publicId => openEntityDrawer(publicId)}
        isLoading={roots.isLoading}
        lockHops={walkerConfig.hops.length > 0}
      />
    </div>
  );
};

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
      <DialogSection label="Starting entity type" required>
        <select
          className={configFormStyles.labelInput}
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
              className={configFormStyles.labelInput}
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
    </>
  );
};

export const PATH_WALKER_TYPE = 'PathWalker' as const;
