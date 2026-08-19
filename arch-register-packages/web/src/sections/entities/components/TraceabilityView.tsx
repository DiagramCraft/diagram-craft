import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { TbChevronDown, TbPlus, TbX } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
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

  return (
    <div className={styles.wrap}>
      {!hideToolbar && (
        <div className={styles.config}>
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
            <span>Traceability configuration</span>
            <span className={styles.configToggleCount}>
              {editorConfig.paths.length} {editorConfig.paths.length === 1 ? 'path' : 'paths'}
            </span>
          </button>
          {configOpen && (
            <div className={styles.configBody}>
              {editorConfig.paths.map(path => {
                return (
                  <div key={path.id} className={styles.path}>
                    <div className={styles.pathHd}>
                      <input
                        className={styles.pathName}
                        value={path.label}
                        aria-label={`Label for ${path.id}`}
                        onChange={event =>
                          updateConfig({
                            ...editorConfig,
                            paths: editorConfig.paths.map(candidate =>
                              candidate.id === path.id
                                ? { ...candidate, label: event.target.value }
                                : candidate
                            )
                          })
                        }
                      />
                      <div className={styles.pathTarget}>
                        <span
                          className={styles.pathTargetLabel}
                          id={`trace-target-label-${path.id}`}
                        >
                          Target schema
                        </span>
                        <Select.Root
                          value={
                            path.targetSchemaIds === 'any'
                              ? 'any'
                              : (path.targetSchemaIds[0] ?? 'any')
                          }
                          aria-labelledby={`trace-target-label-${path.id}`}
                          onChange={value =>
                            updateConfig({
                              ...editorConfig,
                              paths: editorConfig.paths.map(candidate =>
                                candidate.id === path.id
                                  ? {
                                      ...candidate,
                                      targetSchemaIds: value === 'any' || !value ? 'any' : [value]
                                    }
                                  : candidate
                              )
                            })
                          }
                        >
                          <Select.Item value="any">Any</Select.Item>
                          {schemas.map(schema => (
                            <Select.Item key={schema.id} value={schema.id}>
                              {schema.name}
                            </Select.Item>
                          ))}
                        </Select.Root>
                      </div>
                      <button
                        type="button"
                        className={styles.pathRm}
                        title="Remove path"
                        onClick={() => removePath(path.id)}
                      >
                        <TbX size={11} />
                      </button>
                    </div>

                    <div className={styles.hops}>
                      {path.path.map((step, depth) => {
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
                        return (
                          <div key={`${path.id}-${depth}`}>
                            <div className={styles.hop} style={{ marginLeft: depth * 18 }}>
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
                              <Select.Root
                                value={relationId || undefined}
                                aria-labelledby={`trace-relation-label-${path.id}-${depth}`}
                                style={{ maxWidth: 220 }}
                                onChange={value =>
                                  updatePathStep(path.id, depth, value ?? '', direction)
                                }
                              >
                                {stepContext.invalid &&
                                  relationId !== '' &&
                                  !relationIsCompatible && (
                                    <Select.Item value={relationId} disabled>
                                      {selectedRelation
                                        ? `${selectedRelation.name} (incompatible)`
                                        : `Unknown relation (${relationId})`}
                                    </Select.Item>
                                  )}
                                {relationOptions.map(schema => (
                                  <Select.Item key={schema.id} value={schema.id}>
                                    {schema.name}
                                  </Select.Item>
                                ))}
                              </Select.Root>
                              {path.path.length > 1 && (
                                <button
                                  type="button"
                                  className={styles.hopRm}
                                  title="Remove hop"
                                  onClick={() => removePathStep(path.id, depth)}
                                >
                                  <TbX size={10} />
                                </button>
                              )}
                            </div>
                            {stepContext.invalid && (
                              <div className={styles.hopError} style={{ marginLeft: depth * 18 }}>
                                {selectedRelation == null
                                  ? 'This relation schema is no longer available.'
                                  : !selectedRelationDirections.includes(direction)
                                    ? 'This relation cannot be followed in the selected direction.'
                                    : 'The selected direction is incompatible with the current schema.'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className={styles.addHop}
                        style={{ marginLeft: path.path.length * 18 }}
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
                        <TbPlus size={10} /> Add hop
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className={styles.addPath}
                onClick={addPath}
                disabled={compatibleRootDirections.length === 0}
              >
                <TbPlus size={11} /> Add path
              </button>
            </div>
          )}
        </div>
      )}

      {dataError && (
        <div className={styles.error}>
          Traceability data could not be loaded. Coverage statuses are unavailable until it reloads.
        </div>
      )}
      {dataLoading && <div className={styles.loading}>Loading traceability data…</div>}
      {!parsedConfig && (
        <div className={styles.empty}>
          Add a relationship path to start tracing the current entities.
        </div>
      )}
      {parsedConfig && !dataLoading && !dataError && (
        <>
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

          {parsedConfig.showOrphanProjects &&
            showOrphanProjectsPanel &&
            coverage.orphanProjectIds.size > 0 && (
              <section className={styles.gapSection}>
                <h4>Projects without traceability coverage</h4>
                <ul>
                  {visibleProjects
                    .filter(project => coverage.orphanProjectIds.has(project.id))
                    .map(project => (
                      <li key={project.id}>{project.name}</li>
                    ))}
                </ul>
              </section>
            )}
          {parsedConfig.showOrphanEntities &&
            showOrphanEntitiesPanel &&
            orphanEntities.length > 0 && (
              <section className={styles.gapSection}>
                <h4>Entities without traceability coverage</h4>
                <ul>
                  {orphanEntities.slice(0, 50).map(entity => (
                    <li key={entity._uid}>
                      <EntityNavigationLink publicId={entity._publicId}>
                        {entity._name}
                      </EntityNavigationLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}

          <div className={styles.tableWrap}>
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
          </div>
        </>
      )}
    </div>
  );
};
