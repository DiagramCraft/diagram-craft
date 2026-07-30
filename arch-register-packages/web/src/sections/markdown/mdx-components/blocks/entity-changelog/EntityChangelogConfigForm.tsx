import { useState } from 'react';
import { EntityPicker } from '../../../../../components/EntityPicker';
import {
  EntityFilterPanel,
  type EntityFilterValue
} from '../../../../../components/EntityFilterPanel';
import { DialogSection } from '../../../editor/BlockDialog';
import { useEntity } from '../../../../../hooks/useEntities';
import type { EntityChangelogWidgetConfig } from './types';
import styles from './EntityChangelogConfigForm.module.css';

type Mode = 'single' | 'filtered';

const LIMIT_OPTIONS = [
  { value: '10', label: '10 entries' },
  { value: '20', label: '20 entries' },
  { value: '50', label: '50 entries' }
];

const SINCE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last year' },
  { value: '', label: 'All time' }
];

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const buildConfig = (
  mode: Mode,
  entityId: string,
  filter: EntityFilterValue,
  limit: string,
  since: string
): EntityChangelogWidgetConfig => {
  const hasSingleEntity = mode === 'single' && !!entityId;
  return {
    entityId: hasSingleEntity ? entityId : undefined,
    schema: hasSingleEntity ? undefined : optionalText(filter.schemaId),
    owner: hasSingleEntity ? undefined : optionalText(filter.owner),
    lifecycle: hasSingleEntity ? undefined : optionalText(filter.lifecycle),
    limit,
    since
  };
};

type Props = {
  config: EntityChangelogWidgetConfig;
  onChange: (config: EntityChangelogWidgetConfig) => void;
  context: { workspaceSlug: string };
};

export const EntityChangelogConfigForm = ({ config, onChange, context }: Props) => {
  const [mode, setMode] = useState<Mode>(config.entityId ? 'single' : 'filtered');
  const [entityId, setEntityId] = useState(config.entityId ?? '');
  const [filter, setFilter] = useState<EntityFilterValue>({
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
  });
  const [limit, setLimit] = useState(config.limit ?? '10');
  const [since, setSince] = useState(config.since ?? '30d');

  const { data: entity } = useEntity(context.workspaceSlug, entityId);

  const commit = (next: {
    mode?: Mode;
    entityId?: string;
    filter?: EntityFilterValue;
    limit?: string;
    since?: string;
  }) => {
    const nextMode = next.mode ?? mode;
    const nextEntityId = next.entityId ?? entityId;
    const nextFilter = next.filter ?? filter;
    const nextLimit = next.limit ?? limit;
    const nextSince = next.since ?? since;
    if (next.mode !== undefined) setMode(next.mode);
    if (next.entityId !== undefined) setEntityId(next.entityId);
    if (next.filter !== undefined) setFilter(next.filter);
    if (next.limit !== undefined) setLimit(next.limit);
    if (next.since !== undefined) setSince(next.since);
    onChange(buildConfig(nextMode, nextEntityId, nextFilter, nextLimit, nextSince));
  };

  return (
    <>
      <DialogSection label="Source">
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === 'single' ? styles.modeTabActive : ''}`}
            onClick={() => commit({ mode: 'single' })}
          >
            Single entity
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === 'filtered' ? styles.modeTabActive : ''}`}
            onClick={() => commit({ mode: 'filtered' })}
          >
            Filtered set
          </button>
        </div>

        {mode === 'single' && (
          <EntityPicker
            selectedEntityId={entityId}
            selectedEntity={entity}
            onSelectEntity={selected => commit({ entityId: selected._publicId })}
            onClearEntity={() => commit({ entityId: '' })}
          />
        )}

        {mode === 'filtered' && (
          <EntityFilterPanel
            value={filter}
            onChange={update => commit({ filter: { ...filter, ...update } })}
          />
        )}
      </DialogSection>

      <DialogSection label="Options" required={false}>
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Limit</span>
            <select
              className={styles.optionSelect}
              value={limit}
              onChange={e => commit({ limit: e.target.value })}
            >
              {LIMIT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Since</span>
            <select
              className={styles.optionSelect}
              value={since}
              onChange={e => commit({ since: e.target.value })}
            >
              {SINCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
