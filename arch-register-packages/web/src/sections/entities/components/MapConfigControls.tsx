import { useEffect, useMemo, useRef, useState } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import {
  ANY_SOURCE_SCHEMA,
  type MetricAggregation,
  type MetricConfig
} from '@arch-register/api-types/metricContract';
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { TbArrowsExchange, TbChevronDown, TbEyeOff, TbTrash } from 'react-icons/tb';
import styles from './NestedMapView.module.css';
import type { PopoverActions } from '@diagram-craft/app-components/Popover';
import { Popover } from '@diagram-craft/app-components/Popover';
import { ToolbarButton } from '../../../components/ToolbarButton';
import { FilterBuilder } from '../../../components/FilterBuilder';
import {
  AGGREGATION_OPTIONS,
  aggregationOptionLabel,
  isCurrencyMetric,
  isChoiceSource,
  sourceKey
} from './mapMetricConfig';
import type { MetricSourceOption } from './mapMetricConfig';
import type { MapConfig } from './mapViewConfig';
import type { MapLevelConfig } from './mapViewState';
import { LabeledSelect } from '../../../components/LabeledSelect';
import { MAP_COLOR_SCHEME_OPTIONS, type MapColorScheme } from './mapColorScales';
import { HopPicker } from './pathBuilder/HopPicker';
import { HopSequence } from './pathBuilder/HopSequence';
import { CollapsibleSection } from '../../../components/CollapsibleSection';
import { LabeledValue } from '../../../components/LabeledValue';
import { ViewControls } from '../../../components/ViewControls';
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
   *  from any persisted level config (Level 1 has no schema of its own to read once include-path
   *  traversal is active, #3040-map). */
  rootSchemaScope: PathSchemaScope;
  /** Whether the whole level path traverses via correlated PathStep paths - when true, Level 1
   *  has no schema select (it's every entity matching the current filter), matching
   *  Traceability's root scope. */
  useIncludePathTraversal: boolean;
  levelSchemaOptions: Array<Array<{ id: string; name: string }>>;
  notify: (patch: Partial<MapConfig>) => void;
  metricTerminalSchema: EntitySchema | RelationSchema | undefined;
  metricTerminalSchemaId: string | null;
  metricTerminalEntitySchema: EntitySchema | undefined;
  metricTerminalContext: 'entity' | 'relation';
  mapTraversalPath: PathStep[];
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
  // Guarded so it persists a given auto-picked step only once: the save round-trips
  // asynchronously (URL), and `stepContext`/`onChangeStep` change identity on every render, so
  // without the guard the effect re-fires each render until the saved step comes back.
  const persistedAutoStepRef = useRef<string | null>(null);
  useEffect(() => {
    if (hasSavedStep || !step) {
      persistedAutoStepRef.current = null;
      return;
    }
    const key = JSON.stringify(step);
    if (persistedAutoStepRef.current === key) return;
    persistedAutoStepRef.current = key;
    onChangeStep(step, stepContext.options.find(option => option.step === step)?.targetSchemaIds);
  }, [hasSavedStep, step, stepContext, onChangeStep]);
  const candidateSchemaIds = useMemo(
    () => (step && isLastLevel ? targetSchemaIdsForStep(step, schemas, relationSchemas) : []),
    [step, isLastLevel, schemas, relationSchemas]
  );
  if (!step) {
    return (
      <div className={styles.axisPill}>
        <span className={styles.pathSummary}>No traversable relation</span>
      </div>
    );
  }
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

type LevelStepContext = {
  useHopPicker: boolean;
  stepContext: PathStepContext | null;
  resolvedStep: PathStep | undefined;
};

/** For each level, resolves whether it can use the `HopPicker` (every level before it, including
 *  Level 1, must already have a resolved step/schema) and, if so, its `stepContext` - computed
 *  once per level here (mirroring Traceability's `hopEntries`) and reused for both rendering and
 *  resolving the target schema on selection, so the two can never drift apart the way they did
 *  when each computed it independently (#3040-map). Hoisted out of `renderItem` and memoized so an
 *  unrelated re-render (e.g. toggling the hierarchy panel) doesn't re-scan every schema/field for
 *  every level. */
const resolveLevelStepContexts = (
  levelConfigs: MapLevelConfig[],
  rootSchemaScope: PathSchemaScope,
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[],
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess
): LevelStepContext[] => {
  const level0Ok =
    levelConfigs[0]?.schemaId == null ||
    schemas.some(schema => schema.id === levelConfigs[0]!.schemaId);
  return levelConfigs.map((level, index) => {
    const priorStepsRaw = levelConfigs.slice(1, index).map(candidate => candidate.step);
    const priorSteps = priorStepsRaw.filter((step): step is PathStep => step != null);
    const priorStepsResolved = priorSteps.length === priorStepsRaw.length;
    const useHopPicker = index > 0 && priorStepsResolved && level0Ok;
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
    const resolvedStep = stepContext ? (level.step ?? stepContext.options[0]?.step) : undefined;
    return { useHopPicker, stepContext, resolvedStep };
  });
};

export const MapConfigControls = ({
  hideToolbar,
  cfg,
  schemas,
  relationSchemas,
  rootSchemaScope,
  useIncludePathTraversal,
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
}: MapConfigControlsProps) => {
  const [hierarchyOpen, setHierarchyOpen] = useState(true);
  const levelStepContexts = useMemo(
    () =>
      resolveLevelStepContexts(
        cfg.levelConfigs,
        rootSchemaScope,
        schemas,
        relationSchemas,
        getFieldGroupAccess
      ),
    [cfg.levelConfigs, rootSchemaScope, schemas, relationSchemas, getFieldGroupAccess]
  );
  return (
    <>
      {!hideToolbar && (
        <CollapsibleSection title="Hierarchy" open={hierarchyOpen} onOpenChange={setHierarchyOpen}>
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
                (useIncludePathTraversal && cfg.levelConfigs.length === 1)
              )
            }
            renderItem={(level, index) => {
              const { useHopPicker, stepContext, resolvedStep } = levelStepContexts[index]!;

              return (
                <div className={styles.levelControl}>
                  {index === 0 && useIncludePathTraversal ? (
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
        </CollapsibleSection>
      )}

      {!hideToolbar && (
        <ViewControls variant="view">
          <div className={styles.fieldGroup}>
            <LabeledValue label="Type" value={metricTerminalSchema?.name ?? 'Any'} />
            <LabeledSelect
              label="Field"
              value={metricConfig ? sourceKey(metricConfig.source) : ''}
              disabled={mapTraversalError != null}
              onChange={value => {
                const option = metricSourceOptions.find(
                  candidate => sourceKey(candidate.source) === value
                );
                // With no single terminal schema (e.g. the last step reaches several), only
                // schema-independent sources are offered; they apply to terminals of any schema.
                const sourceSchemaId = metricTerminalSchemaId ?? ANY_SOURCE_SCHEMA;
                if (!option) {
                  setMetricConfig(null);
                  return;
                }
                const nextIsChoice = isChoiceSource(option.source);
                const keepsAggregation =
                  metricConfig != null &&
                  ['none', 'count', 'best', 'worst'].includes(metricConfig.aggregation);
                setMetricConfig({
                  ...(metricConfig ?? {
                    sourceSchemaId,
                    source: option.source,
                    aggregation: 'count'
                  }),
                  sourceSchemaId,
                  sourceContext: metricTerminalContext,
                  traversalPath: mapTraversalPath.length > 0 ? mapTraversalPath : undefined,
                  traversalPathMode: 'suffixes',
                  source: option.source,
                  aggregation: nextIsChoice
                    ? keepsAggregation
                      ? metricConfig.aggregation
                      : 'count'
                    : (metricConfig?.aggregation ?? 'count'),
                  worstDirection: metricConfig?.worstDirection,
                  targetCurrency: undefined
                });
              }}
              options={[
                { value: '', label: 'None' },
                ...metricSourceOptions.map(option => ({
                  value: sourceKey(option.source),
                  label: option.label
                }))
              ]}
            />
            {mapTraversalError && <span className={styles.metricError}>{mapTraversalError}</span>}
          </div>

          {metricConfig && (
            <>
              <LabeledSelect
                label="Aggregate"
                value={metricConfig.aggregation}
                onChange={value => {
                  const aggregation = value as MetricAggregation;
                  setMetricConfig({
                    ...metricConfig,
                    aggregation,
                    worstDirection:
                      aggregation === 'worst' || aggregation === 'best'
                        ? (metricConfig.worstDirection ?? 'high')
                        : undefined,
                    targetCurrency:
                      aggregation === 'count' || aggregation === 'percentage'
                        ? undefined
                        : metricConfig.targetCurrency,
                    numeratorCondition:
                      aggregation === 'percentage' ? metricConfig.numeratorCondition : undefined
                  });
                }}
                options={(isChoiceSource(metricConfig.source)
                  ? AGGREGATION_OPTIONS.filter(
                      o =>
                        o.value === 'none' ||
                        o.value === 'count' ||
                        o.value === 'best' ||
                        o.value === 'worst'
                    )
                  : AGGREGATION_OPTIONS
                ).map(o => ({
                  value: o.value,
                  label: aggregationOptionLabel(o, isChoiceSource(metricConfig.source))
                }))}
              />

              {(metricConfig.aggregation === 'worst' || metricConfig.aggregation === 'best') && (
                <LabeledSelect
                  label="Direction"
                  value={metricConfig.worstDirection ?? 'high'}
                  onChange={value =>
                    setMetricConfig({ ...metricConfig, worstDirection: value as 'low' | 'high' })
                  }
                  options={
                    isChoiceSource(metricConfig.source)
                      ? [
                          { value: 'high', label: 'Last option is worst' },
                          { value: 'low', label: 'First option is worst' }
                        ]
                      : [
                          { value: 'high', label: 'High is worse' },
                          { value: 'low', label: 'Low is worse' }
                        ]
                  }
                />
              )}

              {isCurrencyMetric(metricConfig, metricSourceSchema) && (
                <LabeledSelect
                  label="Currency"
                  value={metricConfig.targetCurrency ?? currencies.default_currency}
                  onChange={value => setMetricConfig({ ...metricConfig, targetCurrency: value })}
                  options={currencies.currencies.map(currency => ({
                    value: currency.code,
                    label: `${currency.code} — ${currency.label}`
                  }))}
                />
              )}

              {metricConfig.aggregation === 'percentage' && metricTerminalEntitySchema && (
                <Popover.Root actionsRef={numeratorConditionPopoverRef}>
                  <Popover.Trigger
                    element={
                      <ToolbarButton variant={metricConfig.numeratorCondition ? 'primary' : undefined}>
                        {metricConfig.numeratorCondition ? 'Numerator: 1 condition' : 'Numerator…'}
                      </ToolbarButton>
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

              <LabeledSelect
                label="Colors"
                value={cfg.colorScheme ?? 'blue'}
                onChange={value => notify({ colorScheme: value as MapColorScheme })}
                options={MAP_COLOR_SCHEME_OPTIONS}
              />

              <ToolbarButton
                variant={cfg.reverseColors ? 'primary' : undefined}
                icon={<TbArrowsExchange size={13} />}
                title={cfg.reverseColors ? 'Use the normal color order' : 'Reverse the color order'}
                aria-label={
                  cfg.reverseColors ? 'Use the normal color order' : 'Reverse the color order'
                }
                aria-pressed={cfg.reverseColors === true}
                onClick={() => notify({ reverseColors: !cfg.reverseColors })}
              />

              <ToolbarButton
                variant={cfg.hideMissingMetricData ? 'primary' : undefined}
                icon={<TbEyeOff size={13} />}
                title={
                  cfg.hideMissingMetricData ? 'Show boxes without data' : 'Hide boxes without data'
                }
                aria-label={
                  cfg.hideMissingMetricData ? 'Show boxes without data' : 'Hide boxes without data'
                }
                aria-pressed={cfg.hideMissingMetricData === true}
                onClick={() => notify({ hideMissingMetricData: !cfg.hideMissingMetricData })}
              />
            </>
          )}
        </ViewControls>
      )}
    </>
  );
};
