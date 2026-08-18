import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type {
  MetricAggregation,
  MetricConfig,
  MetricTraversalStep
} from '@arch-register/api-types/metricContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { TbChevronDown, TbEyeOff, TbTrash } from 'react-icons/tb';
import styles from './MapView.module.css';
import type { PopoverActions } from '@diagram-craft/app-components/Popover';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Button } from '@diagram-craft/app-components/Button';
import { FilterBuilder } from '../../../components/FilterBuilder';
import { AGGREGATION_OPTIONS, isCurrencyMetric, isEnumSource, sourceKey } from './mapMetricConfig';
import type { MetricSourceOption } from './mapMetricConfig';
import type { MapConfig } from './mapViewConfig';

type MapConfigControlsProps = {
  hideToolbar?: boolean;
  cfg: MapConfig;
  levelSchemaOptions: Array<Array<{ id: string; name: string }>>;
  notify: (patch: Partial<MapConfig>) => void;
  metricTerminalSchema: EntitySchema | RelationSchema | undefined;
  metricTerminalSchemaId: string | null;
  metricTerminalEntitySchema: EntitySchema | undefined;
  metricTerminalContext: 'entity' | 'relation';
  mapTraversalPath: MetricTraversalStep[];
  mapTraversalError?: string;
  metricConfig: MetricConfig | null;
  setMetricConfig: (next: MetricConfig | null) => void;
  metricSourceSchema: EntitySchema | RelationSchema | undefined;
  metricSourceOptions: MetricSourceOption[];
  currencies: { currencies: Array<{ code: string; label: string }>; default_currency: string };
  teams: WorkspaceTeam[];
  enums: WorkspaceEnum[];
  lifecycleStates: WorkspaceLifecycleState[];
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  numeratorConditionPopoverRef: { current: PopoverActions | null };
};

const SchemaSelect = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string | null;
  options: Array<{ id: string; name: string }>;
  onChange: (id: string | null) => void;
}) => (
  <div className={styles.axisPill}>
    <span className={styles.axisKicker}>{label}</span>
    <div className={styles.selectWrap}>
      <select
        className={styles.select}
        value={value ?? ''}
        onChange={e => onChange(e.target.value ?? null)}
      >
        <option value="">— select —</option>
        {options.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <TbChevronDown size={11} />
    </div>
  </div>
);

const ColsSelect = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <div className={styles.selectWrap}>
    <select
      className={styles.select}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    >
      {[1, 2, 3, 4].map(n => (
        <option key={n} value={n}>
          {n} col{n > 1 ? 's' : ''}
        </option>
      ))}
    </select>
    <TbChevronDown size={11} />
  </div>
);

export const MapConfigControls = ({
  hideToolbar,
  cfg,
  levelSchemaOptions,
  notify,
  metricTerminalSchema,
  metricTerminalSchemaId,
  metricTerminalEntitySchema,
  metricTerminalContext,
  mapTraversalPath,
  mapTraversalError,
  metricConfig,
  setMetricConfig,
  metricSourceSchema,
  metricSourceOptions,
  currencies,
  teams,
  enums,
  lifecycleStates,
  getFieldGroupAccess,
  numeratorConditionPopoverRef
}: MapConfigControlsProps) => (
  <>
    {!hideToolbar && (
      <div className={styles.config}>
        {cfg.levelConfigs.map((level, index) => (
          <div key={index} className={styles.levelControl}>
            {index > 0 && <span className={styles.cross}>›</span>}
            <SchemaSelect
              label={`L${index + 1}`}
              value={level.schemaId}
              options={levelSchemaOptions[index] ?? []}
              onChange={id => {
                const nextLevels = cfg.levelConfigs
                  .slice(0, index + 1)
                  .map((candidate, candidateIndex) =>
                    candidateIndex === index ? { ...candidate, schemaId: id } : candidate
                  );
                notify({ levelConfigs: nextLevels });
              }}
            />
            <ColsSelect
              value={level.columns}
              onChange={columns => {
                const nextLevels = cfg.levelConfigs.map((candidate, candidateIndex) =>
                  candidateIndex === index ? { ...candidate, columns } : candidate
                );
                notify({ levelConfigs: nextLevels });
              }}
            />
            {index > 0 && (
              <>
                <button
                  type="button"
                  className={`${styles.levelAction} ${level.hidden ? styles.levelHidden : ''}`}
                  aria-label={`${level.hidden ? 'Show' : 'Hide'} level ${index + 1}`}
                  aria-pressed={level.hidden === true}
                  title={`${level.hidden ? 'Show' : 'Hide'} level ${index + 1}`}
                  onClick={() => {
                    const nextLevels = cfg.levelConfigs.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? { ...candidate, hidden: candidate.hidden !== true }
                        : candidate
                    );
                    notify({ levelConfigs: nextLevels });
                  }}
                >
                  <TbEyeOff size={13} />
                </button>
                {index === cfg.levelConfigs.length - 1 && (
                  <button
                    type="button"
                    className={styles.levelAction}
                    aria-label={`Remove level ${index + 1}`}
                    onClick={() =>
                      notify({
                        levelConfigs: cfg.levelConfigs.filter(
                          (_, candidateIndex) => candidateIndex !== index
                        )
                      })
                    }
                  >
                    <TbTrash size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        {cfg.levelConfigs.at(-1)?.schemaId && <span className={styles.cross}>›</span>}
        <button
          type="button"
          className={styles.levelAction}
          disabled={!cfg.levelConfigs.at(-1)?.schemaId}
          onClick={() =>
            notify({
              levelConfigs: [...cfg.levelConfigs, { schemaId: null, columns: 3, hidden: false }]
            })
          }
        >
          + Add level
        </button>
      </div>
    )}

    {!hideToolbar && (
      <div className={styles.config}>
        <div className={styles.axisPill}>
          <span className={styles.axisKicker}>Metric</span>
          <span className={styles.pathSummary}>
            {metricTerminalSchema?.name ?? 'Select the final map level'}
          </span>
          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={metricConfig ? sourceKey(metricConfig.source) : ''}
              disabled={mapTraversalError != null}
              onChange={e => {
                const option = metricSourceOptions.find(
                  candidate => sourceKey(candidate.source) === e.target.value
                );
                if (!option || !metricTerminalSchemaId) {
                  setMetricConfig(null);
                  return;
                }
                const nextIsEnum = isEnumSource(option.source);
                setMetricConfig({
                  ...(metricConfig ?? {
                    sourceSchemaId: metricTerminalSchemaId,
                    source: option.source,
                    aggregation: 'count'
                  }),
                  sourceSchemaId: metricTerminalSchemaId,
                  sourceContext: metricTerminalContext,
                  path: mapTraversalPath.length > 0 ? mapTraversalPath : undefined,
                  source: option.source,
                  aggregation: nextIsEnum ? 'count' : (metricConfig?.aggregation ?? 'count'),
                  worstDirection: nextIsEnum ? undefined : metricConfig?.worstDirection,
                  targetCurrency: undefined
                });
              }}
            >
              <option value="">None</option>
              {metricSourceOptions.map(option => (
                <option key={sourceKey(option.source)} value={sourceKey(option.source)}>
                  {option.label}
                </option>
              ))}
            </select>
            <TbChevronDown size={11} />
          </div>
          {mapTraversalError && <span className={styles.metricError}>{mapTraversalError}</span>}
        </div>

        {metricConfig && (
          <>
            <span className={styles.cross}>›</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={metricConfig.aggregation}
                onChange={e => {
                  const aggregation = e.target.value as MetricAggregation;
                  setMetricConfig({
                    ...metricConfig,
                    aggregation,
                    worstDirection:
                      aggregation === 'worst' ? (metricConfig.worstDirection ?? 'high') : undefined,
                    targetCurrency:
                      aggregation === 'count' || aggregation === 'percentage'
                        ? undefined
                        : metricConfig.targetCurrency,
                    numeratorCondition:
                      aggregation === 'percentage' ? metricConfig.numeratorCondition : undefined
                  });
                }}
              >
                {(isEnumSource(metricConfig.source)
                  ? AGGREGATION_OPTIONS.filter(o => o.value === 'count' || o.value === 'worst')
                  : AGGREGATION_OPTIONS
                ).map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>

            {metricConfig.aggregation === 'worst' && (
              <div className={styles.selectWrap}>
                <select
                  className={styles.select}
                  value={metricConfig.worstDirection ?? 'high'}
                  onChange={e =>
                    setMetricConfig({
                      ...metricConfig,
                      worstDirection: e.target.value as 'low' | 'high'
                    })
                  }
                >
                  {isEnumSource(metricConfig.source) ? (
                    <>
                      <option value="high">Last option is worst</option>
                      <option value="low">First option is worst</option>
                    </>
                  ) : (
                    <>
                      <option value="high">High is worse</option>
                      <option value="low">Low is worse</option>
                    </>
                  )}
                </select>
                <TbChevronDown size={11} />
              </div>
            )}

            {isCurrencyMetric(metricConfig, metricSourceSchema) && (
              <div className={styles.selectWrap}>
                <select
                  className={styles.select}
                  value={metricConfig.targetCurrency ?? currencies.default_currency}
                  onChange={e =>
                    setMetricConfig({
                      ...metricConfig,
                      targetCurrency: e.target.value
                    })
                  }
                >
                  {currencies.currencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} — {currency.label}
                    </option>
                  ))}
                </select>
                <TbChevronDown size={11} />
              </div>
            )}

            {metricConfig.aggregation === 'percentage' && metricTerminalEntitySchema && (
              <Popover.Root actionsRef={numeratorConditionPopoverRef}>
                <Popover.Trigger
                  element={
                    <Button
                      size="sm"
                      variant={metricConfig.numeratorCondition ? 'primary' : 'secondary'}
                    >
                      {metricConfig.numeratorCondition ? 'Numerator: 1 condition' : 'Numerator…'}
                    </Button>
                  }
                />
                <Popover.Content sideOffset={4} align="start" arrow={false} closeButton={false}>
                  <FilterBuilder
                    conditions={
                      metricConfig.numeratorCondition ? [metricConfig.numeratorCondition] : []
                    }
                    onChange={conditions =>
                      setMetricConfig({
                        ...metricConfig,
                        numeratorCondition: conditions[conditions.length - 1]
                      })
                    }
                    onClose={() => numeratorConditionPopoverRef.current?.close()}
                    schemas={[metricTerminalEntitySchema]}
                    lifecycleStates={lifecycleStates}
                    owners={teams}
                    enums={enums}
                    selectedSchemaId={metricTerminalEntitySchema.id}
                    getFieldGroupAccess={getFieldGroupAccess}
                  />
                </Popover.Content>
              </Popover.Root>
            )}

            <label className={styles.metricToggle}>
              <input
                type="checkbox"
                checked={cfg.hideMissingMetricData === true}
                onChange={e => notify({ hideMissingMetricData: e.target.checked })}
              />
              Hide missing
            </label>
          </>
        )}
      </div>
    )}
  </>
);
