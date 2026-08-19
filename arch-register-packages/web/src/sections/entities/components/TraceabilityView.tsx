import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
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
import type { BrowserEntityRecord } from './entityBrowserState';
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

const formatCount = (value: number) => (value === 1 ? '1 item' : `${value} items`);

const statusStyle = (covered: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 7px',
  borderRadius: 999,
  background: covered ? 'var(--green-bg, #dcfce7)' : 'var(--red-bg, #fee2e2)',
  color: covered ? 'var(--green-text, #166534)' : 'var(--red-text, #991b1b)',
  fontSize: 11,
  fontWeight: 600
});

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {!hideToolbar && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0 }}>Traceability configuration</h3>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Configure generic relationship paths from the current entity query.
              </div>
            </div>
            <button
              type="button"
              onClick={addPath}
              disabled={compatibleRootDirections.length === 0}
            >
              Add path
            </button>
          </div>
          {editorConfig.paths.map(path => {
            return (
              <div key={path.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
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
                  <select
                    value={
                      path.targetSchemaIds === 'any' ? 'any' : (path.targetSchemaIds[0] ?? 'any')
                    }
                    aria-label={`Target schema for ${path.id}`}
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
                    <option value="any">Any target schema</option>
                    {schemas.map(schema => (
                      <option key={schema.id} value={schema.id}>
                        {schema.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig({
                        ...editorConfig,
                        paths: editorConfig.paths.filter(candidate => candidate.id !== path.id)
                      })
                    }
                  >
                    Remove path
                  </button>
                </div>
                {path.path.map((step, depth) => {
                  const stepContext = traceabilityPathStepContext({
                    rootSchemaScope,
                    path,
                    depth,
                    relationSchemas
                  });
                  const relationId =
                    step.kind === 'unboundTypedRelation' ? step.relationSchemaId : '';
                  const direction = step.kind === 'unboundTypedRelation' ? step.direction : 'in';
                  const selectedRelation = relationSchemas.find(schema => schema.id === relationId);
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
                  const visibleDirectionOptions = [
                    ...new Set([
                      ...availableDirections,
                      ...(stepContext.invalid && step.kind === 'unboundTypedRelation'
                        ? [step.direction]
                        : [])
                    ])
                  ];
                  return (
                    <div
                      key={`${path.id}-${depth}`}
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                    >
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ width: 48, color: 'var(--text-muted)', fontSize: 12 }}>
                          Hop {depth + 1}
                        </span>
                        <select
                          value={direction}
                          aria-label={`Direction for ${path.id} hop ${depth + 1}`}
                          onChange={event =>
                            updatePathDirection(
                              path.id,
                              depth,
                              relationId,
                              event.target.value as 'in' | 'out',
                              stepContext.currentSchemaScope
                            )
                          }
                        >
                          {visibleDirectionOptions.map(option => (
                            <option
                              key={option}
                              value={option}
                              disabled={!availableDirections.includes(option)}
                            >
                              {option === 'in' ? '->' : '<-'}
                              {!availableDirections.includes(option) ? ' (incompatible)' : ''}
                            </option>
                          ))}
                        </select>
                        <select
                          value={relationId}
                          aria-label={`Relation for ${path.id} hop ${depth + 1}`}
                          onChange={event =>
                            updatePathStep(path.id, depth, event.target.value, direction)
                          }
                        >
                          {stepContext.invalid && relationId !== '' && !relationIsCompatible && (
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
                        {path.path.length > 1 && (
                          <button type="button" onClick={() => removePathStep(path.id, depth)}>
                            Remove hop
                          </button>
                        )}
                      </div>
                      {stepContext.invalid && (
                        <span style={{ color: 'var(--red-text, #991b1b)', fontSize: 12 }}>
                          {selectedRelation == null
                            ? 'This relation schema is no longer available.'
                            : !selectedRelationDirections.includes(direction)
                              ? 'This relation cannot be followed in the selected direction.'
                              : 'The selected direction is incompatible with the current schema.'}
                        </span>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
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
                  Add hop
                </button>
              </div>
            );
          })}
        </section>
      )}

      {dataError && (
        <div style={{ color: 'var(--red-text, #991b1b)' }}>
          Traceability data could not be loaded. Coverage statuses are unavailable until it reloads.
        </div>
      )}
      {dataLoading && <div>Loading traceability data…</div>}
      {!parsedConfig && (
        <div style={{ color: 'var(--text-muted)' }}>
          Add a relationship path to start tracing the current entities.
        </div>
      )}
      {parsedConfig && !dataLoading && !dataError && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={statusStyle(coverage.rows.every(row => row.architectureCovered))}>
              Entity: {coverage.rows.filter(row => row.architectureCovered).length}/
              {coverage.rows.length} covered
            </span>
            <span style={statusStyle(coverage.rows.every(row => row.deliveryCovered))}>
              Delivery: {coverage.rows.filter(row => row.deliveryCovered).length}/
              {coverage.rows.length} covered
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {formatCount(coverage.orphanProjectIds.size)} without alignment
            </span>
            {parsedConfig.showOrphanEntities && (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {formatCount(orphanEntities.length)} orphan entities
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>Root entity</th>
                  {parsedConfig.paths.map(path => (
                    <th key={path.id} style={{ textAlign: 'left', padding: 8 }}>
                      {path.label}
                    </th>
                  ))}
                  <th style={{ textAlign: 'left', padding: 8 }}>Entity</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {coverage.rows.map(row => (
                  <tr key={row.root._uid}>
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      <EntityNavigationLink publicId={row.root._publicId}>
                        {row.root._name}
                      </EntityNavigationLink>
                    </td>
                    {row.paths.map(path => (
                      <td key={path.pathId} style={{ padding: 8, verticalAlign: 'top' }}>
                        {path.nodes.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>No linked entities</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {path.nodes.slice(0, 8).map(node => (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  const details = pathEntityDetails.get(node.id);
                                  if (details) onEntityClick(details.publicId);
                                }}
                                disabled={!pathEntityDetails.has(node.id)}
                                style={{ textAlign: 'left' }}
                              >
                                {node.name}
                              </button>
                            ))}
                            {path.nodes.length > 8 && (
                              <span style={{ color: 'var(--text-muted)' }}>
                                +{path.nodes.length - 8} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    ))}
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      <span style={statusStyle(row.architectureCovered)}>
                        {row.architectureCovered ? 'Covered' : 'Gap'}
                      </span>
                    </td>
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      <span style={statusStyle(row.deliveryCovered)}>
                        {row.deliveryCovered ? 'Covered' : 'Gap'}
                      </span>
                      {row.alignedProjects.length > 0 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                          {row.alignedProjects.map(project => project.name).join(', ')}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedConfig.showOrphanProjects && coverage.orphanProjectIds.size > 0 && (
            <section>
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
          {parsedConfig.showOrphanEntities && orphanEntities.length > 0 && (
            <section>
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
        </>
      )}
    </div>
  );
};
