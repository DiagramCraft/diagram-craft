import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { TbChevronDown, TbPlus, TbTrash, TbX } from 'react-icons/tb';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import {
  MAX_PATH_HOPS,
  type EntityQuery,
  type PathStep
} from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { TraceabilityViewConfig } from '@arch-register/api-types/viewContract';
import { projectEntitiesQuery } from '../../../queries/projects';
import { useEntities, useEntitiesByIds, useEntitiesBySchema } from '../../../hooks/useEntities';
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
  traceabilityAvailableDirections,
  traceabilityCompatibleRelationsForDirection,
  traceabilityPathStepContext,
  traceabilityRelationIdForDirection,
  traceabilityRelationDirections
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

const CELL_VISIBLE_NODES = 6;

const pathStep = (relationSchemaId: string, direction: 'in' | 'out'): PathStep => ({
  kind: 'unboundTypedRelation',
  relationSchemaId,
  direction
});

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
  const targetSchemaIds = parsedConfig ? collectTargetSchemaIds(parsedConfig) : [];
  const anyTargetSchema = parsedConfig ? hasAnyTargetSchema(parsedConfig) : false;
  const candidateBySchema = useEntitiesBySchema(workspaceId, targetSchemaIds);
  const allCandidates = useEntities(workspaceId, { view: 'summary' }, { enabled: anyTargetSchema });

  const schemaById = useMemo(() => new Map(schemas.map(schema => [schema.id, schema])), [schemas]);
  const schemaIndexById = useMemo(
    () => new Map(schemas.map((schema, index) => [schema.id, index])),
    [schemas]
  );
  const renderTypeBadge = (schemaId: string | undefined, size: number) => {
    if (!schemaId) return null;
    const schema = schemaById.get(schemaId);
    if (!schema) return null;
    const index = schemaIndexById.get(schemaId) ?? 0;
    return <TypeBadge color={resolveSchemaColor(schema, index)} icon={schema.icon} size={size} />;
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
    () => traceabilityAvailableDirections(relationSchemas, rootSchemaScope),
    [relationSchemas, rootSchemaScope]
  );
  const addPath = () => {
    const direction = compatibleRootDirections[0];
    if (!direction) return;
    const relation = traceabilityCompatibleRelationsForDirection(
      relationSchemas,
      rootSchemaScope,
      direction
    )[0];
    if (!relation) return;
    setConfigOpen(true);
    updateConfig({
      ...editorConfig,
      paths: [
        ...editorConfig.paths,
        {
          id: `path-${editorConfig.paths.length + 1}`,
          label: relation.name,
          path: [pathStep(relation.id, direction)],
          targetSchemaIds: 'any'
        }
      ]
    });
  };
  const updatePathStep = (
    pathId: string,
    depth: number,
    relationSchemaId: string,
    direction: 'in' | 'out'
  ) => {
    updateConfig({
      ...editorConfig,
      paths: editorConfig.paths.map(path =>
        path.id === pathId
          ? {
              ...path,
              path: path.path.map((step, index) =>
                index === depth ? pathStep(relationSchemaId, direction) : step
              )
            }
          : path
      )
    });
  };
  const addPathStep = (pathId: string) => {
    const path = editorConfig.paths.find(candidate => candidate.id === pathId);
    if (!path) return;
    const context = traceabilityPathStepContext({
      rootSchemaScope,
      path,
      depth: path.path.length,
      relationSchemas
    });
    const direction = traceabilityAvailableDirections(
      relationSchemas,
      context.currentSchemaScope
    )[0];
    if (!direction) return;
    const relation = traceabilityCompatibleRelationsForDirection(
      relationSchemas,
      context.currentSchemaScope,
      direction
    )[0];
    if (!relation) return;
    updateConfig({
      ...editorConfig,
      paths: editorConfig.paths.map(path =>
        path.id === pathId && path.path.length < MAX_PATH_HOPS
          ? { ...path, path: [...path.path, pathStep(relation.id, direction)] }
          : path
      )
    });
  };
  const updatePathDirection = (
    pathId: string,
    depth: number,
    relationSchemaId: string,
    direction: 'in' | 'out',
    currentSchemaScope: readonly string[] | 'any'
  ) => {
    updatePathStep(
      pathId,
      depth,
      traceabilityRelationIdForDirection(
        relationSchemas,
        currentSchemaScope,
        direction,
        relationSchemaId
      ) ?? relationSchemaId,
      direction
    );
  };
  const removePathStep = (pathId: string, depth: number) => {
    updateConfig({
      ...editorConfig,
      paths: editorConfig.paths.map(path =>
        path.id === pathId && path.path.length > 1
          ? { ...path, path: path.path.filter((_step, index) => index !== depth) }
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
                    <TextInput
                      value={path.label}
                      aria-labelledby={`trace-label-label-${path.id}`}
                      style={
                        {
                          width: 150,
                          height: 24,
                          '--cmp-bg': 'var(--panel-bg)',
                          '--cmp-border': 'var(--panel-border)',
                          '--cmp-radius': 'var(--r)'
                        } as React.CSSProperties
                      }
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

                    {(() => {
                      const hopEntries = path.path.map((step, depth) => {
                        const stepContext = traceabilityPathStepContext({
                          rootSchemaScope,
                          path,
                          depth,
                          relationSchemas
                        });
                        const relationId =
                          step.kind === 'unboundTypedRelation' ? step.relationSchemaId : '';
                        const direction =
                          step.kind === 'unboundTypedRelation' ? step.direction : 'in';
                        const selectedRelation = relationSchemas.find(
                          schema => schema.id === relationId
                        );
                        const availableDirections = traceabilityAvailableDirections(
                          relationSchemas,
                          stepContext.currentSchemaScope
                        );
                        const selectedRelationDirections = selectedRelation
                          ? traceabilityRelationDirections(
                              selectedRelation,
                              stepContext.currentSchemaScope
                            )
                          : [];
                        const relationOptions = traceabilityCompatibleRelationsForDirection(
                          relationSchemas,
                          stepContext.currentSchemaScope,
                          direction
                        );
                        const relationIsCompatible =
                          selectedRelation != null &&
                          relationOptions.some(schema => schema.id === selectedRelation.id);
                        const oppositeDirection = direction === 'in' ? 'out' : 'in';
                        const canToggleDirection = availableDirections.includes(oppositeDirection);
                        const errorMessage = !stepContext.invalid
                          ? null
                          : selectedRelation == null
                            ? 'This relation schema is no longer available.'
                            : !selectedRelationDirections.includes(direction)
                              ? 'This relation cannot be followed in the selected direction.'
                              : 'The selected direction is incompatible with the current schema.';

                        return {
                          depth,
                          errorMessage,
                          element: (
                            <div key={`${path.id}-${depth}`} className={styles.hop}>
                              {depth > 0 && <span className={styles.hopSep}>›</span>}
                              <button
                                type="button"
                                className={styles.hopDir}
                                aria-label={`Direction for ${path.id} hop ${depth + 1}`}
                                title={
                                  canToggleDirection
                                    ? `Traversing ${direction} — click to reverse`
                                    : `Traversing ${direction}`
                                }
                                disabled={!canToggleDirection}
                                onClick={() =>
                                  updatePathDirection(
                                    path.id,
                                    depth,
                                    relationId,
                                    oppositeDirection,
                                    stepContext.currentSchemaScope
                                  )
                                }
                              >
                                {direction === 'in' ? '→' : '←'}
                              </button>
                              <span
                                className={styles.visuallyHidden}
                                id={`trace-relation-label-${path.id}-${depth}`}
                              >
                                Relation for {path.id} hop {depth + 1}
                              </span>
                              <div className={styles.selectWrap}>
                                <select
                                  className={styles.select}
                                  value={relationId}
                                  aria-labelledby={`trace-relation-label-${path.id}-${depth}`}
                                  onChange={event =>
                                    updatePathStep(path.id, depth, event.target.value, direction)
                                  }
                                >
                                  {stepContext.invalid &&
                                    relationId !== '' &&
                                    !relationIsCompatible && (
                                      <option value={relationId} disabled>
                                        {selectedRelation
                                          ? `${selectedRelation.name} (incompatible)`
                                          : `Unknown relation (${relationId})`}
                                      </option>
                                    )}
                                  {relationOptions.map(schema => (
                                    <option key={schema.id} value={schema.id}>
                                      {schema.name}
                                    </option>
                                  ))}
                                </select>
                                <TbChevronDown size={11} />
                              </div>
                              {path.path.length > 1 && (
                                <button
                                  type="button"
                                  className={styles.hopRm}
                                  title="Remove hop"
                                  onClick={() => removePathStep(path.id, depth)}
                                >
                                  <TbTrash size={13} />
                                </button>
                              )}
                            </div>
                          )
                        };
                      });

                      return (
                        <>
                          <span className={styles.pathTargetLabel}>Path</span>

                          <div className={styles.hopsCell}>
                            <span className={styles.hopsRow}>
                              {hopEntries.map(entry => entry.element)}
                              <button
                                type="button"
                                className={styles.addHop}
                                onClick={() => addPathStep(path.id)}
                                disabled={
                                  path.path.length >= MAX_PATH_HOPS ||
                                  traceabilityAvailableDirections(
                                    relationSchemas,
                                    traceabilityPathStepContext({
                                      rootSchemaScope,
                                      path,
                                      depth: path.path.length,
                                      relationSchemas
                                    }).currentSchemaScope
                                  ).length === 0
                                }
                              >
                                + Add hop
                              </button>
                            </span>

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
                        </>
                      );
                    })()}

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
                        expandedCells.has(cellKey) || path.nodes.length <= CELL_VISIBLE_NODES;
                      const shown = expanded
                        ? path.nodes
                        : path.nodes.slice(0, CELL_VISIBLE_NODES - 1);
                      return (
                        <td key={path.pathId}>
                          {path.nodes.length === 0 ? (
                            <span className={styles.cellEmpty}>No linked entities</span>
                          ) : (
                            <div className={styles.cell}>
                              {shown.map(node => (
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
                              {!expanded && (
                                <button
                                  type="button"
                                  className={styles.pathMore}
                                  onClick={() => toggleCell(cellKey)}
                                >
                                  +{path.nodes.length - shown.length} more
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
