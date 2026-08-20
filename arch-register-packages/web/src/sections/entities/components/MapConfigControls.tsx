import { useEffect } from 'react';
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
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
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
import { HopPicker } from './pathBuilder/HopPicker';
import { HopSequence } from './pathBuilder/HopSequence';
import {
  pathStepContextWithFallbackDirection,
  pathStepOptions,
  targetSchemaIdsForStep,
  type PathSchemaScope,
  type PathStepContext
} from './pathBuilder/pathBuilderState';

type MapConfigControlsProps = {
  hideToolbar?: boolean;
  cfg: MapConfig;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  /** Live root schema scope - the same concept Traceability threads through
   *  `traceabilityPathStepContext` as `rootSchemaScope`, derived from the current view filter, NOT
   *  from any persisted level config (Level 1 has no schema of its own to read once chain
   *  traversal is active, #3040-map). */
  rootSchemaScope: PathSchemaScope;
  /** Whether the whole level chain traverses via correlated PathStep chains - when true, Level 1
   *  has no schema select (it's every entity matching the current filter), matching
   *  Traceability's root scope. */
  useChainTraversal: boolean;
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
  value,
  options,
  onChange
}: {
  value: string | null;
  options: Array<{ id: string; name: string }>;
  onChange: (id: string | null) => void;
}) => (
  <div className={styles.axisPill}>
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

/** Level 2+ editor for a plain entity-to-entity hop, replacing the flat schema select with the
 *  shared `HopPicker` so a level can traverse any relation kind, not just containment - the same
 *  component and the same `pathStepContext`/`pathStepOptions` logic Traceability's path builder
 *  uses, just rendered as stacked levels instead of inline chips. `stepContext` is computed once
 *  by the caller (mirroring Traceability's `hopEntries`) and reused for both rendering and
 *  resolving the target schema on selection, so the two can never drift apart the way they did
 *  when each computed it independently (#3040-map). Only rendered when every level up to and
 *  including this one is a plain entity level - a level configured as "a relation schema shown as
 *  its own map box" keeps the legacy `SchemaSelect` below instead, since that isn't representable
 *  as a `PathStep`. */
const MapLevelHop = ({
  index,
  step,
  stepContext,
  hasSavedStep,
  schemas,
  relationSchemas,
  getFieldGroupAccess,
  onChangeStep,
  isLastLevel,
  targetSchemaId,
  onChangeTargetSchemaId
}: {
  index: number;
  step: PathStep | undefined;
  stepContext: PathStepContext;
  hasSavedStep: boolean;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  onChangeStep: (step: PathStep, targetSchemaIds?: string[]) => void;
  isLastLevel: boolean;
  targetSchemaId: string | null;
  onChangeTargetSchemaId: (id: string | null) => void;
}) => {
  // A freshly added level auto-picks its first legal hop for display, but that choice isn't saved
  // until the user touches the control - persist it immediately so the level actually contributes
  // to the map right away instead of silently doing nothing until re-selected.
  useEffect(() => {
    if (!hasSavedStep && step) {
      onChangeStep(step, stepContext.options.find(option => option.step === step)?.targetSchemaIds);
    }
  }, [hasSavedStep, step, stepContext, onChangeStep]);
  if (!step) {
    return (
      <div className={styles.axisPill}>
        <span className={styles.pathSummary}>No traversable relation</span>
      </div>
    );
  }
  const candidateSchemaIds = isLastLevel
    ? targetSchemaIdsForStep(step, schemas, relationSchemas)
    : [];
  return (
    <div className={styles.axisPill}>
      <HopPicker
        step={step}
        stepContext={stepContext}
        ariaLabelDirection={`Direction for level ${index + 1}`}
        ariaLabelHop={`Hop for level ${index + 1}`}
        onChangeStep={onChangeStep}
        onToggleDirection={direction => {
          const option = pathStepOptions({
            direction,
            currentSchemaScope: stepContext.currentSchemaScope,
            schemas,
            relationSchemas,
            getFieldGroupAccess
          })[0];
          if (option) onChangeStep(option.step, option.targetSchemaIds);
        }}
        renderExtra={
          candidateSchemaIds.length > 1
            ? () => (
                <div className={styles.selectWrap}>
                  <select
                    className={styles.select}
                    value={targetSchemaId ?? 'any'}
                    aria-label={`Target schema for level ${index + 1}`}
                    onChange={e =>
                      onChangeTargetSchemaId(e.target.value === 'any' ? null : e.target.value)
                    }
                  >
                    <option value="any">Any</option>
                    {candidateSchemaIds.map(id => (
                      <option key={id} value={id}>
                        {schemas.find(schema => schema.id === id)?.name ?? id}
                      </option>
                    ))}
                  </select>
                  <TbChevronDown size={11} />
                </div>
              )
            : undefined
        }
      />
    </div>
  );
};

export const MapConfigControls = ({
  hideToolbar,
  cfg,
  schemas,
  relationSchemas,
  rootSchemaScope,
  useChainTraversal,
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
        <span className={styles.axisKicker}>Hierarchy</span>
        <HopSequence
          items={cfg.levelConfigs}
          getItemKey={(_level, index) => index}
          onAdd={() =>
            notify({
              levelConfigs: [...cfg.levelConfigs, { schemaId: null, columns: 3, hidden: false }]
            })
          }
          addLabel="Add level"
          addDisabled={
            !(
              cfg.levelConfigs.at(-1)?.schemaId != null ||
              (useChainTraversal && cfg.levelConfigs.length === 1)
            )
          }
          renderItem={(level, index) => {
            // Every level before this one needs an already-resolved step for this level's hop to be
            // computable, and Level 1 must not be a relation-as-its-own-level (legacy feature, not
            // representable as a PathStep) - otherwise this level falls back to the legacy schema
            // select below.
            const priorStepsRaw = cfg.levelConfigs.slice(1, index).map(candidate => candidate.step);
            const priorSteps = priorStepsRaw.filter((step): step is PathStep => step != null);
            const priorStepsResolved = priorSteps.length === priorStepsRaw.length;
            const level0Ok =
              cfg.levelConfigs[0]?.schemaId == null ||
              schemas.some(schema => schema.id === cfg.levelConfigs[0]!.schemaId);
            const useHopPicker = index > 0 && priorStepsResolved && level0Ok;
            // One `stepContext`, computed once, drives both what's rendered and what a selection
            // resolves to - the same pattern Traceability's `hopEntries` uses. Two independent
            // computations (one for display, one for persistence) is what let them drift apart and
            // save a step without its resolved schema (#3040-map).
            const stepContext = useHopPicker
              ? pathStepContextWithFallbackDirection({
                  rootSchemaScope,
                  steps: level.step ? [...priorSteps, level.step] : priorSteps,
                  depth: index - 1,
                  schemas,
                  relationSchemas,
                  getFieldGroupAccess
                })
              : null;
            const resolvedStep = stepContext
              ? (level.step ?? stepContext.options[0]?.step)
              : undefined;

            return (
              <div className={styles.levelControl}>
                {index === 0 && useChainTraversal ? (
                  <div className={styles.axisPill}>
                    <span className={styles.pathSummary}>Root</span>
                  </div>
                ) : useHopPicker && stepContext ? (
                  <MapLevelHop
                    index={index}
                    step={resolvedStep}
                    stepContext={stepContext}
                    hasSavedStep={level.step != null}
                    schemas={schemas}
                    relationSchemas={relationSchemas}
                    getFieldGroupAccess={getFieldGroupAccess}
                    onChangeStep={(step, targetSchemaIds) => {
                      const nextLevels = cfg.levelConfigs
                        .slice(0, index + 1)
                        .map((candidate, candidateIndex) =>
                          candidateIndex === index
                            ? {
                                ...candidate,
                                schemaId: targetSchemaIds?.[0] ?? candidate.schemaId,
                                step
                              }
                            : candidate
                        );
                      notify({ levelConfigs: nextLevels });
                    }}
                    isLastLevel={index === cfg.levelConfigs.length - 1}
                    targetSchemaId={level.targetSchemaId ?? null}
                    onChangeTargetSchemaId={targetSchemaId => {
                      const nextLevels = cfg.levelConfigs.map((candidate, candidateIndex) =>
                        candidateIndex === index ? { ...candidate, targetSchemaId } : candidate
                      );
                      notify({ levelConfigs: nextLevels });
                    }}
                  />
                ) : (
                  <SchemaSelect
                    value={level.schemaId}
                    options={levelSchemaOptions[index] ?? []}
                    onChange={id => {
                      const nextLevels = cfg.levelConfigs
                        .slice(0, index + 1)
                        .map((candidate, candidateIndex) =>
                          candidateIndex === index
                            ? { ...candidate, schemaId: id, step: undefined }
                            : candidate
                        );
                      notify({ levelConfigs: nextLevels });
                    }}
                  />
                )}
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
            );
          }}
        />
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
