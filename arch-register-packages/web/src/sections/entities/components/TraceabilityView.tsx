import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { TbChevronDown, TbPlus, TbTrash, TbX } from 'react-icons/tb';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import {
  MAX_PATH_HOPS,
  type EntityQuery,
  type PathStep
} from '@arch-register/api-types/entityQueryIR';
import { HopPicker } from './pathBuilder/HopPicker';
import { HopSequence } from './pathBuilder/HopSequence';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { TraceabilityViewConfig } from '@arch-register/api-types/viewContract';
import { projectEntitiesQuery } from '../../../queries/projects';
import { useEntities, useEntitiesByIds, useEntitiesBySchema } from '../../../hooks/useEntities';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { EmptyState } from '../../../components/EmptyState';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { BrowserEntityRecord } from './entityBrowserState';
import styles from './TraceabilityView.module.css';
import {
  buildTraceabilityCoverage,
  buildTraceabilityEntityQuery,
  buildTraceabilityRoots,
  collectTargetSchemaIds,
  entityIsOrphan,
  hasAnyTargetSchema,
  parseTraceabilityConfig,
  pruneInvalidTraceabilityPaths,
  traceabilityPathOptions,
  traceabilityPathStepContext
} from './traceabilityViewState';

type TraceabilityViewProps = {
  rows: BrowserEntityRecord[];
  rootSchemaIds: string[];
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  projects: Project[];
  workspaceId: string;
  projectId?: string;
  executionEntityQuery?: EntityQuery | null;
  config: unknown;
  onConfigChange: (config: unknown) => void;
  onEntityClick: (entityId: string) => void;
  hideToolbar: boolean;
  isLoading?: boolean;
};

const DEFAULT_SOURCES: TraceabilityViewConfig['deliverySources'] = ['projects'];

const emptyConfig = (): Omit<TraceabilityViewConfig, 'paths'> & {
  paths: TraceabilityViewConfig['paths'];
} => ({
  paths: [],
  deliverySources: DEFAULT_SOURCES,
  showOrphanEntities: true,
  showOrphanProjects: true
});

const CELL_VISIBLE_CHAINS = 3;

export const TraceabilityView = ({
  rows,
  rootSchemaIds,
  schemas,
  relationSchemas,
  projects,
  workspaceId,
  projectId,
  executionEntityQuery,
  config,
  onConfigChange,
  onEntityClick,
  hideToolbar,
  isLoading: rowsLoading = false
}: TraceabilityViewProps) => {
  const [configOpen, setConfigOpen] = useState(true);
  const [showOrphanProjectsPanel, setShowOrphanProjectsPanel] = useState(false);
  const [showOrphanEntitiesPanel, setShowOrphanEntitiesPanel] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const toggleCell = (key: string) =>
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const parsedConfig = parseTraceabilityConfig(config);
  const editorConfig = parsedConfig ?? emptyConfig();
  const rootSchemaScope = useMemo<readonly string[]>(
    () => (rootSchemaIds.length > 0 ? rootSchemaIds : schemas.map(schema => schema.id)),
    [rootSchemaIds, schemas]
  );
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  // A saved hop can become unselectable (its option no longer appears in the dropdown) when the
  // schemas/relations reachable at that depth change out from under it - e.g. a sidebar filter
  // narrows the root schema scope. Rather than leaving it stuck showing "Unavailable hop" with no
  // way to fix it from the dropdown, drop it and any hops after it (or the whole path, if even its
  // first hop is invalid) as soon as that happens.
  useEffect(() => {
    if (hideToolbar || !parsedConfig) return;
    const pruned = pruneInvalidTraceabilityPaths(parsedConfig, {
      rootSchemaScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
    if (pruned !== parsedConfig) onConfigChange(pruned);
  }, [
    hideToolbar,
    parsedConfig,
    rootSchemaScope,
    schemas,
    relationSchemas,
    getFieldGroupAccess,
    onConfigChange
  ]);
  const pathOptionsAt = (
    path: TraceabilityViewConfig['paths'][number],
    depth: number,
    direction: 'in' | 'out'
  ) => {
    const context = traceabilityPathStepContext({
      rootSchemaScope,
      path,
      depth,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
    return direction === context.direction
      ? context.options
      : traceabilityPathOptions({
          direction,
          currentSchemaScope: context.currentSchemaScope,
          schemas,
          relationSchemas,
          getFieldGroupAccess
        });
  };
  const targetSchemaIds = parsedConfig ? collectTargetSchemaIds(parsedConfig) : [];
  const anyTargetSchema = parsedConfig ? hasAnyTargetSchema(parsedConfig) : false;
  const candidateBySchema = useEntitiesBySchema(workspaceId, targetSchemaIds);
  const allCandidates = useEntities(workspaceId, { view: 'summary' }, { enabled: anyTargetSchema });

  const schemaById = useMemo(
    () => new Map(schemas.map((schema, index) => [schema.id, { schema, index }])),
    [schemas]
  );
  const renderTypeBadge = (schemaId: string | undefined, size: number) => {
    if (!schemaId) return null;
    const entry = schemaById.get(schemaId);
    if (!entry) return null;
    return (
      <TypeBadge
        color={resolveSchemaColor(entry.schema, entry.index)}
        icon={entry.schema.icon}
        size={size}
      />
    );
  };
  const visibleProjects = useMemo(
    () =>
      projectId
        ? projects.filter(project => project.id === projectId || project.public_id === projectId)
        : projects,
    [projectId, projects]
  );
  const projectEntityResults = useQueries({
    queries: visibleProjects.map(project => projectEntitiesQuery(workspaceId, project.id))
  });

  const { aliases } = useMemo(
    () => buildTraceabilityEntityQuery(executionEntityQuery, parsedConfig),
    [executionEntityQuery, parsedConfig]
  );
  const roots = useMemo(
    () => buildTraceabilityRoots(rows, aliases, parsedConfig),
    [aliases, parsedConfig, rows]
  );

  const memberships = useMemo(
    () =>
      new Map(
        visibleProjects.map((project, index) => [
          project.id,
          (projectEntityResults[index]?.data ?? []).map(entity => entity.entity_id)
        ])
      ),
    [projectEntityResults, visibleProjects]
  );
  const coverage = useMemo(
    () =>
      parsedConfig
        ? buildTraceabilityCoverage({
            roots,
            projects: visibleProjects,
            memberships
          })
        : { rows: [], orphanProjectIds: new Set<string>(), coveredEntityIds: new Set<string>() },
    [memberships, parsedConfig, roots, visibleProjects]
  );

  const candidateEntities = useMemo(
    () =>
      anyTargetSchema ? allCandidates.data : candidateBySchema.flatMap(result => result.data ?? []),
    [allCandidates.data, anyTargetSchema, candidateBySchema]
  );
  const orphanEntities = useMemo(
    () => candidateEntities.filter(entity => entityIsOrphan(entity, coverage.coveredEntityIds)),
    [candidateEntities, coverage.coveredEntityIds]
  );
  const pathEntityIds = useMemo(
    () => [...new Set(coverage.rows.flatMap(row => [...row.graphNodeIds]))],
    [coverage.rows]
  );
  const pathEntityDetails = useEntitiesByIds(workspaceId, pathEntityIds);
  const dataLoading =
    rowsLoading ||
    projectEntityResults.some(result => result.isLoading || result.isFetching) ||
    candidateBySchema.some(result => result.isLoading || result.isFetching) ||
    allCandidates.isLoading;
  const dataError =
    projectEntityResults.some(result => result.isError) ||
    candidateBySchema.some(result => result.isError) ||
    allCandidates.isError;

  const updateConfig = (next: TraceabilityViewConfig) => onConfigChange(next);
  const compatibleRootDirections = useMemo(
    () =>
      (['in', 'out'] as const).filter(
        direction =>
          traceabilityPathOptions({
            direction,
            currentSchemaScope: rootSchemaScope,
            schemas,
            relationSchemas,
            getFieldGroupAccess
          }).length > 0
      ),
    [rootSchemaScope, schemas, relationSchemas, getFieldGroupAccess]
  );
  const addPath = () => {
    const direction = compatibleRootDirections[0];
    if (!direction) return;
    const option = traceabilityPathOptions({
      direction,
      currentSchemaScope: rootSchemaScope,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    })[0];
    if (!option) return;
    setConfigOpen(true);
    updateConfig({
      ...editorConfig,
      paths: [
        ...editorConfig.paths,
        {
          id: `path-${editorConfig.paths.length + 1}`,
          label: 'Trace',
          path: [option.step],
          targetSchemaIds: 'any'
        }
      ]
    });
  };
  const updatePathStep = (pathId: string, depth: number, step: PathStep) => {
    updateConfig({
      ...editorConfig,
      paths: editorConfig.paths.map(path =>
        path.id === pathId
          ? {
              ...path,
              path: path.path.map((existing, index) => (index === depth ? step : existing))
            }
          : path
      )
    });
  };
  const nextHopContext = (path: TraceabilityViewConfig['paths'][number]) =>
    traceabilityPathStepContext({
      rootSchemaScope,
      path,
      depth: path.path.length,
      schemas,
      relationSchemas,
      getFieldGroupAccess
    });
  const canAddHop = (path: TraceabilityViewConfig['paths'][number]) =>
    path.path.length < MAX_PATH_HOPS && nextHopContext(path).availableDirections.length > 0;
  const addPathStep = (pathId: string) => {
    const path = editorConfig.paths.find(candidate => candidate.id === pathId);
    if (!path) return;
    const context = nextHopContext(path);
    const direction = context.availableDirections[0];
    if (!direction) return;
    const option = pathOptionsAt(path, path.path.length, direction)[0];
    if (!option) return;
    updateConfig({
      ...editorConfig,
      paths: editorConfig.paths.map(candidate =>
        candidate.id === pathId && candidate.path.length < MAX_PATH_HOPS
          ? { ...candidate, path: [...candidate.path, option.step] }
          : candidate
      )
    });
  };
  const updatePathDirection = (
    path: TraceabilityViewConfig['paths'][number],
    depth: number,
    direction: 'in' | 'out'
  ) => {
    const option = pathOptionsAt(path, depth, direction)[0];
    if (!option) return;
    updatePathStep(path.id, depth, option.step);
  };
  // Only the last hop can be removed, matching Map's level removal - trimming from the middle
  // would leave later hops referencing a schema scope that no longer has a defined predecessor.
  const removeLastPathStep = (pathId: string) => {
    updateConfig({
      ...editorConfig,
      paths: editorConfig.paths.map(path =>
        path.id === pathId && path.path.length > 1
          ? { ...path, path: path.path.slice(0, -1) }
          : path
      )
    });
  };
  const removePath = (pathId: string) => {
    updateConfig({
      ...editorConfig,
      paths: editorConfig.paths.filter(candidate => candidate.id !== pathId)
    });
  };

  const entityAllCovered = coverage.rows.every(row => row.architectureCovered);
  const deliveryAllCovered = coverage.rows.every(row => row.deliveryCovered);
  const showOrphanProjectsSection =
    parsedConfig?.showOrphanProjects === true &&
    showOrphanProjectsPanel &&
    coverage.orphanProjectIds.size > 0;
  const showOrphanEntitiesSection =
    parsedConfig?.showOrphanEntities === true &&
    showOrphanEntitiesPanel &&
    orphanEntities.length > 0;

  return (
    <div className={styles.wrap}>
      {!hideToolbar && (
        <div className={styles.config}>
          <div className={styles.configHeader}>
            <button
              type="button"
              className={styles.configToggle}
              onClick={() => setConfigOpen(open => !open)}
            >
              <TbChevronDown
                size={12}
                className={styles.configToggleIcon}
                data-open={configOpen ? 'true' : 'false'}
              />
              <span className={styles.configTitle}>Traceability configuration</span>
            </button>
            <button
              type="button"
              className={styles.addPath}
              onClick={addPath}
              disabled={compatibleRootDirections.length === 0}
            >
              <TbPlus size={11} /> Add path
            </button>
          </div>
          {configOpen && (
            <div className={styles.configBody}>
              {editorConfig.paths.map(path => {
                const hopEntries = path.path.map((_step, depth) => {
                  const stepContext = traceabilityPathStepContext({
                    rootSchemaScope,
                    path,
                    depth,
                    schemas,
                    relationSchemas,
                    getFieldGroupAccess
                  });
                  const errorMessage = !stepContext.invalid
                    ? null
                    : 'This hop is no longer available for the current schema.';

                  return { depth, errorMessage, stepContext };
                });

                return (
                  <div key={path.id} className={styles.path}>
                    <button
                      type="button"
                      className={styles.pathRm}
                      title="Remove path"
                      onClick={() => removePath(path.id)}
                    >
                      <TbX size={11} />
                    </button>

                    <span className={styles.pathTargetLabel} id={`trace-label-label-${path.id}`}>
                      Path label
                    </span>
                    <div className={styles.pathLabelInput}>
                      <TextInput
                        value={path.label}
                        aria-labelledby={`trace-label-label-${path.id}`}
                        style={{ width: 150, height: 24 }}
                        onChange={value =>
                          updateConfig({
                            ...editorConfig,
                            paths: editorConfig.paths.map(candidate =>
                              candidate.id === path.id
                                ? { ...candidate, label: value ?? '' }
                                : candidate
                            )
                          })
                        }
                      />
                    </div>

                    <span className={styles.pathTargetLabel}>Path</span>

                    <div className={styles.hopsCell}>
                      <HopSequence
                        items={path.path}
                        getItemKey={(_step, depth) => `${path.id}-${depth}`}
                        renderItem={(step, depth) => {
                          const { stepContext } = hopEntries[depth]!;
                          return (
                            <div className={styles.hop}>
                              <HopPicker
                                step={step}
                                stepContext={stepContext}
                                ariaLabelDirection={`Direction for ${path.id} hop ${depth + 1}`}
                                ariaLabelHop={`Hop for ${path.id} hop ${depth + 1}`}
                                onChangeStep={nextStep => updatePathStep(path.id, depth, nextStep)}
                                onToggleDirection={direction =>
                                  updatePathDirection(path, depth, direction)
                                }
                              />
                              {path.path.length > 1 && depth === path.path.length - 1 && (
                                <button
                                  type="button"
                                  className={styles.hopRm}
                                  title="Remove hop"
                                  onClick={() => removeLastPathStep(path.id)}
                                >
                                  <TbTrash size={13} />
                                </button>
                              )}
                            </div>
                          );
                        }}
                        onAdd={() => addPathStep(path.id)}
                        addLabel="Add hop"
                        addDisabled={!canAddHop(path)}
                      />

                      {hopEntries.some(entry => entry.errorMessage) && (
                        <div className={styles.hopErrors}>
                          {hopEntries
                            .filter(entry => entry.errorMessage)
                            .map(entry => (
                              <div
                                key={`${path.id}-error-${entry.depth}`}
                                className={styles.hopError}
                              >
                                Hop {entry.depth + 1}: {entry.errorMessage}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <span className={styles.pathTargetLabel} id={`trace-target-label-${path.id}`}>
                      Target
                    </span>
                    <div className={styles.selectWrap}>
                      <select
                        className={styles.select}
                        value={
                          path.targetSchemaIds === 'any'
                            ? 'any'
                            : (path.targetSchemaIds[0] ?? 'any')
                        }
                        aria-labelledby={`trace-target-label-${path.id}`}
                        onChange={event =>
                          updateConfig({
                            ...editorConfig,
                            paths: editorConfig.paths.map(candidate =>
                              candidate.id === path.id
                                ? {
                                    ...candidate,
                                    targetSchemaIds:
                                      event.target.value === 'any' ? 'any' : [event.target.value]
                                  }
                                : candidate
                            )
                          })
                        }
                      >
                        <option value="any">Any</option>
                        {schemas.map(schema => (
                          <option key={schema.id} value={schema.id}>
                            {schema.name}
                          </option>
                        ))}
                      </select>
                      <TbChevronDown size={11} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {parsedConfig && !dataLoading && !dataError && (
        <div className={styles.summary}>
          <span
            className={`${styles.badge} ${entityAllCovered ? styles.badgeOk : styles.badgeWarn}`}
          >
            Entity: {coverage.rows.filter(row => row.architectureCovered).length}/
            {coverage.rows.length} covered
          </span>
          <span
            className={`${styles.badge} ${deliveryAllCovered ? styles.badgeOk : styles.badgeWarn}`}
          >
            Delivery: {coverage.rows.filter(row => row.deliveryCovered).length}/
            {coverage.rows.length} covered
          </span>
          {parsedConfig.showOrphanProjects &&
            (coverage.orphanProjectIds.size > 0 ? (
              <button
                type="button"
                className={styles.statLink}
                onClick={() => setShowOrphanProjectsPanel(open => !open)}
              >
                {coverage.orphanProjectIds.size} projects without traceability coverage
              </button>
            ) : (
              <span className={styles.statText}>0 projects without traceability coverage</span>
            ))}
          {parsedConfig.showOrphanEntities &&
            (orphanEntities.length > 0 ? (
              <button
                type="button"
                className={styles.statLink}
                onClick={() => setShowOrphanEntitiesPanel(open => !open)}
              >
                {orphanEntities.length} entities without traceability coverage
              </button>
            ) : (
              <span className={styles.statText}>0 entities without traceability coverage</span>
            ))}
        </div>
      )}

      <div className={styles.scroll}>
        {dataError ? (
          <EmptyState
            title="Traceability data could not be loaded"
            subtitle="Coverage statuses are unavailable until it reloads."
          />
        ) : dataLoading ? (
          <EmptyState title="Loading traceability data…" />
        ) : !parsedConfig ? (
          <EmptyState
            title="No relationship paths configured"
            subtitle="Add a relationship path to start tracing the current entities."
          />
        ) : (
          <>
            {showOrphanProjectsSection && (
              <section className={styles.gapSection}>
                <h4>Projects without traceability coverage</h4>
                <div className={styles.gapChips}>
                  {visibleProjects
                    .filter(project => coverage.orphanProjectIds.has(project.id))
                    .map(project => (
                      <span key={project.id} className={styles.gapChip}>
                        {project.name}
                      </span>
                    ))}
                </div>
              </section>
            )}
            {showOrphanEntitiesSection && (
              <section className={styles.gapSection}>
                <h4>Entities without traceability coverage</h4>
                <div className={styles.gapChips}>
                  {orphanEntities.slice(0, 50).map(entity => (
                    <EntityNavigationLink
                      key={entity._uid}
                      publicId={entity._publicId}
                      className={styles.gapChip}
                    >
                      {entity._name}
                    </EntityNavigationLink>
                  ))}
                </div>
              </section>
            )}

            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colRoot}>Root entity</th>
                  {parsedConfig.paths.map(path => (
                    <th key={path.id}>{path.label}</th>
                  ))}
                  <th className={styles.colStatus}>Entity</th>
                  <th className={styles.colStatus}>Delivery</th>
                  <th className={styles.colStatus}>Completion</th>
                </tr>
              </thead>
              <tbody>
                {coverage.rows.map(row => (
                  <tr key={row.root._uid}>
                    <td className={styles.colRoot}>
                      <EntityNavigationLink
                        publicId={row.root._publicId}
                        className={styles.rootBtn}
                      >
                        {renderTypeBadge(row.root._schema.id, 15)}
                        <span className={styles.rootName}>{row.root._name}</span>
                      </EntityNavigationLink>
                    </td>
                    {row.paths.map(path => {
                      const cellKey = `${row.root._uid}|${path.pathId}`;
                      const expanded =
                        expandedCells.has(cellKey) || path.chains.length <= CELL_VISIBLE_CHAINS;
                      const shown = expanded
                        ? path.chains
                        : path.chains.slice(0, CELL_VISIBLE_CHAINS);
                      return (
                        <td key={path.pathId}>
                          {path.chains.length === 0 ? (
                            <span className={styles.cellEmpty}>No linked entities</span>
                          ) : (
                            <div className={styles.cell}>
                              {shown.map((chain, chainIndex) => (
                                <div
                                  key={`${path.pathId}-${chainIndex}`}
                                  className={styles.pathChain}
                                >
                                  {chain.map(node => (
                                    <span key={node.id} className={styles.pathStep}>
                                      <span className={styles.pathArrow}>→</span>
                                      <button
                                        type="button"
                                        className={styles.pathNode}
                                        onClick={() => {
                                          const details = pathEntityDetails.get(node.id);
                                          if (details) onEntityClick(details.publicId);
                                        }}
                                        disabled={!pathEntityDetails.has(node.id)}
                                      >
                                        {node.name}
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ))}
                              {!expanded && (
                                <button
                                  type="button"
                                  className={styles.pathMore}
                                  onClick={() => toggleCell(cellKey)}
                                >
                                  +{path.chains.length - shown.length} more
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className={styles.colStatus}>
                      <span
                        className={`${styles.pill} ${row.architectureCovered ? styles.pillOk : styles.pillGap}`}
                      >
                        <span className={styles.pillDot} />
                        {row.architectureCovered ? 'Covered' : 'Gap'}
                      </span>
                    </td>
                    <td className={styles.colStatus}>
                      <span
                        className={`${styles.pill} ${row.deliveryCovered ? styles.pillOk : styles.pillGap}`}
                      >
                        <span className={styles.pillDot} />
                        {row.deliveryCovered ? 'Covered' : 'Gap'}
                      </span>
                      {row.alignedProjects.length > 0 && (
                        <div className={styles.pillProjects}>
                          {row.alignedProjects.map(project => project.name).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className={styles.colStatus}>
                      {row.completionRate === null ? (
                        <span className={styles.cellEmpty}>No linked projects</span>
                      ) : (
                        <span
                          className={`${styles.completionText} ${
                            row.completionRate === 1
                              ? styles.completionOk
                              : row.completionRate >= 2 / 3
                                ? styles.completionPartial
                                : styles.completionGap
                          }`}
                        >
                          {
                            row.alignedProjects.filter(project => project.status === 'complete')
                              .length
                          }
                          /{row.alignedProjects.length} projects complete (
                          {Math.round(row.completionRate * 100)}%)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};
