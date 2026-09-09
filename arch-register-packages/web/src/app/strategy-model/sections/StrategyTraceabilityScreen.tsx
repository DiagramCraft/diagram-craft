import { useMemo } from 'react';
import { useParams, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Title } from '../../../components/Title';
import { Table } from '../../../components/table/Table';
import { EntityHoverCard } from '../../../components/EntityHoverCard';
import { useEntityTree } from '../../../hooks/useEntities';
import { useRelations } from '../../../hooks/useRelations';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { resolveStrategyModelConfig } from '../strategyQueries';
import { CapabilityDrawer } from './CapabilityDrawer';
import { STRATEGY_RAIL_PATHS, STRATEGY_TRACEABILITY_ID } from '../strategySections';
import type { TraceabilitySearchParams } from '../../../routes/searchParams';
import styles from './StrategyTraceabilityScreen.module.css';

const TRACE_ROUTE = STRATEGY_RAIL_PATHS[STRATEGY_TRACEABILITY_ID];

type Endpoint = { id: string; name: string };
type TraceabilityTab = 'chain' | 'orphans';

const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * Traceability section: a Tabs-switched view over
 * - **Trace chain** — a three-column hop walker Objective → Capability → Application, walked one
 *   hop at a time over the typed relations `objective-supports-business-capability` and
 *   `business-capability-supports-entity`, with an Initiatives sub-list for the selected objective
 *   and a path summary of the current selection.
 * - **No strategy link** — the capabilities that no objective supports.
 *
 * Ports the design reference's `BCMTraceability` (`bcm-views.jsx`).
 *
 * A `layout=walker|matrix` toggle surfacing the `strategy-traceability` template view
 * (`TraceabilityView` matrix) is tracked as a follow-up (issue #3212).
 */
export const StrategyTraceabilityScreen = () => {
  const { workspaceSlug, capabilityId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    capabilityId?: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as TraceabilitySearchParams;
  const tab: TraceabilityTab = search.tab === 'orphans' ? 'orphans' : 'chain';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const strategyConfig = resolveStrategyModelConfig(configurations.data);
  const enabled = strategyConfig != null;

  const objectives = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.objectiveSchemaId ?? null, view: 'summary', limit: 1000 },
      enabled
    )
  );
  // `view: 'full'` so the orphan list can read `capability_level` (a derived schema `data` field
  // the summary projection omits) — same reason `StrategyCapabilitiesScreen` fetches full.
  const capabilities = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.businessCapabilitySchemaId ?? null, view: 'full', limit: 1000 },
      enabled
    )
  );
  // Shared cache entry with the sidebar's capability tree — used to show each orphan capability's
  // ancestor path.
  const tree = useEntityTree(
    workspaceSlug,
    { schemaId: strategyConfig?.businessCapabilitySchemaId ?? undefined },
    enabled
  );
  // Both typed relations fetched workspace-wide, then joined in memory — the walker needs the whole
  // Objective→Capability and Capability→Application graph, not one entity's slice. Keyed by the
  // real per-workspace relation schema ids from `strategyConfig` (the template's symId strings
  // never match `_schema.id`); see `CapabilityDrawer`.
  const objectiveSupportsCapability = useRelations(
    workspaceSlug,
    { schemaId: strategyConfig?.objectiveSupportsBusinessCapabilityRelationSchemaId },
    {
      enabled:
        enabled && strategyConfig?.objectiveSupportsBusinessCapabilityRelationSchemaId != null
    }
  );
  const capabilitySupportsEntity = useRelations(
    workspaceSlug,
    { schemaId: strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId },
    { enabled: enabled && strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId != null }
  );

  const objectiveList = objectives.data?.items ?? [];
  const selectedObjectiveId = search.objective ?? objectiveList[0]?._uid ?? null;
  const selectedObjective = objectiveList.find(o => o._uid === selectedObjectiveId) ?? null;

  // objective (`_in`) → capabilities (`_out`)
  const capabilitiesByObjective = useMemo(() => {
    const byObjective = new Map<string, Endpoint[]>();
    for (const relation of objectiveSupportsCapability.data) {
      const list = byObjective.get(relation._in.id) ?? [];
      list.push({ id: relation._out.id, name: relation._out.name });
      byObjective.set(relation._in.id, list);
    }
    return byObjective;
  }, [objectiveSupportsCapability.data]);

  const linkedCapabilityIds = useMemo(
    () => new Set(objectiveSupportsCapability.data.map(relation => relation._out.id)),
    [objectiveSupportsCapability.data]
  );

  // capability (`_in`) → applications / entities (`_out`)
  const applicationsByCapability = useMemo(() => {
    const byCapability = new Map<string, Endpoint[]>();
    for (const relation of capabilitySupportsEntity.data) {
      const list = byCapability.get(relation._in.id) ?? [];
      list.push({ id: relation._out.id, name: relation._out.name });
      byCapability.set(relation._in.id, list);
    }
    return byCapability;
  }, [capabilitySupportsEntity.data]);

  const objectiveCapabilities = selectedObjectiveId
    ? (capabilitiesByObjective.get(selectedObjectiveId) ?? [])
    : [];
  const selectedCapability =
    objectiveCapabilities.find(c => c.id === search.capability) ?? objectiveCapabilities[0] ?? null;
  const applications = selectedCapability
    ? (applicationsByCapability.get(selectedCapability.id) ?? [])
    : [];

  const initiatives = useQuery(
    entitiesQuery(
      workspaceSlug,
      {
        schemaId: strategyConfig?.initiativeSchemaId ?? null,
        view: 'summary',
        conditions: [
          {
            fieldId: 'objectives',
            op: 'in',
            value: selectedObjectiveId ? [selectedObjectiveId] : []
          }
        ]
      },
      enabled && selectedObjectiveId != null
    )
  );

  // childId → parentId, for the orphan list's ancestor-path column.
  const parentOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const edge of tree.data?.edges ?? []) map.set(edge.childId, edge.parentId);
    return map;
  }, [tree.data]);
  const nameByUid = useMemo(
    () => new Map((tree.data?.nodes ?? []).map(node => [node._uid, node._name])),
    [tree.data]
  );
  const ancestorPath = (uid: string): string => {
    const names: string[] = [];
    let current = parentOf.get(uid);
    while (current) {
      const name = nameByUid.get(current);
      if (name) names.unshift(name);
      current = parentOf.get(current);
    }
    return names.join(' › ');
  };

  // Capabilities that never appear as the `_out` endpoint of an
  // `objective-supports-business-capability` relation. A plain set-membership check, matching the
  // design reference — a non-leaf capability whose descendants carry the link still counts as an
  // orphan here (same simplification the `CapabilityDrawer` notes for its "Linked objectives"
  // section).
  const orphanCapabilities = useMemo(
    () => (capabilities.data?.items ?? []).filter(entity => !linkedCapabilityIds.has(entity._uid)),
    [capabilities.data, linkedCapabilityIds]
  );

  const currentRoute = capabilityId
    ? { to: `${TRACE_ROUTE}/$capabilityId`, params: { workspaceSlug, capabilityId } }
    : { to: TRACE_ROUTE, params: { workspaceSlug } };

  const patchSearch = (patch: Partial<TraceabilitySearchParams>) =>
    navigate({
      ...currentRoute,
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const selectTab = (next: string) =>
    patchSearch({ tab: next === 'orphans' ? 'orphans' : undefined });
  const selectObjective = (id: string) => patchSearch({ objective: id, capability: undefined });
  const selectCapability = (id: string) => patchSearch({ capability: id });

  const openCapability = (id: string) =>
    navigate({
      to: `${TRACE_ROUTE}/$capabilityId`,
      params: { workspaceSlug, capabilityId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeCapability = () =>
    navigate({
      to: TRACE_ROUTE,
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading strategy model…</div>;
  }
  if (!strategyConfig) {
    return <div className={styles.empty}>Strategy model is not enabled.</div>;
  }

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <Title
          title="Traceability"
          description="Objective → capability → application, walked one hop at a time over existing typed relations."
        />
      </div>

      <Tabs.Root value={tab} onValueChange={selectTab}>
        <Tabs.List>
          <Tabs.Trigger value="chain">Trace chain</Tabs.Trigger>
          <Tabs.Trigger value="orphans">
            No strategy link <span className={styles.tabCount}>({orphanCapabilities.length})</span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="chain">
          <div className={styles.path}>
            <span className={styles.pathNode}>
              {selectedObjective ? (
                <EntityHoverCard entityId={selectedObjective._uid}>
                  {selectedObjective._name}
                </EntityHoverCard>
              ) : (
                '—'
              )}
            </span>
            <span className={styles.pathArrow}>→</span>
            <span className={styles.pathNode}>
              {selectedCapability ? (
                <EntityHoverCard entityId={selectedCapability.id}>
                  {selectedCapability.name}
                </EntityHoverCard>
              ) : (
                '—'
              )}
            </span>
            <span className={styles.pathArrow}>→</span>
            <span className={`${styles.pathNode} dim`}>
              {applications.length} {applications.length === 1 ? 'application' : 'applications'}
            </span>
          </div>

          <div className={styles.walker}>
            <div className={styles.column}>
              <div className={styles.columnHead}>
                Objectives <span className={styles.count}>{objectiveList.length}</span>
              </div>
              {objectiveList.length === 0 ? (
                <div className={styles.columnEmpty}>
                  {objectives.isLoading ? 'Loading…' : 'No objectives yet.'}
                </div>
              ) : (
                objectiveList.map(objective => (
                  <button
                    key={objective._uid}
                    type="button"
                    className={`${styles.row} ${objective._uid === selectedObjectiveId ? styles.rowActive : ''}`}
                    onClick={() => selectObjective(objective._uid)}
                  >
                    <span className={styles.name}>
                      <EntityHoverCard entityId={objective._uid}>{objective._name}</EntityHoverCard>
                    </span>
                    <span className={styles.rowMeta}>
                      {(capabilitiesByObjective.get(objective._uid) ?? []).length}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className={styles.link}>
              <span className={styles.linkLabel}>supports</span>
              <span className={styles.linkArrow} />
              <span className={styles.linkSub}>{objectiveCapabilities.length}</span>
            </div>

            <div className={styles.column}>
              <div className={styles.columnHead}>
                Capabilities <span className={styles.count}>{objectiveCapabilities.length}</span>
              </div>
              {objectiveCapabilities.length === 0 ? (
                <div className={styles.columnEmpty}>This objective supports no capability.</div>
              ) : (
                objectiveCapabilities.map(capability => (
                  <button
                    key={capability.id}
                    type="button"
                    className={`${styles.row} ${capability.id === selectedCapability?.id ? styles.rowActive : ''}`}
                    onClick={() => selectCapability(capability.id)}
                  >
                    <span className={styles.name}>
                      <EntityHoverCard entityId={capability.id}>{capability.name}</EntityHoverCard>
                    </span>
                    <span className={styles.rowMeta}>
                      {(applicationsByCapability.get(capability.id) ?? []).length}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className={styles.link}>
              <span className={styles.linkLabel}>realized by</span>
              <span className={styles.linkArrow} />
              <span className={styles.linkSub}>{applications.length}</span>
            </div>

            <div className={styles.column}>
              <div className={styles.columnHead}>
                Applications <span className={styles.count}>{applications.length}</span>
              </div>
              {applications.length === 0 ? (
                <div className={styles.columnEmpty}>No application realizes this capability.</div>
              ) : (
                applications.map(application => (
                  <button
                    key={application.id}
                    type="button"
                    className={styles.row}
                    onClick={() =>
                      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(application.id)))
                    }
                  >
                    <span className={styles.name}>
                      <EntityHoverCard entityId={application.id}>
                        {application.name}
                      </EntityHoverCard>
                    </span>
                  </button>
                ))
              )}

              <div className={styles.columnHead}>
                Initiatives{' '}
                <span className={styles.count}>{initiatives.data?.items.length ?? 0}</span>
              </div>
              {selectedObjectiveId == null ? (
                <div className={styles.columnEmpty}>Select an objective.</div>
              ) : initiatives.isLoading ? (
                <div className={styles.columnEmpty}>Loading…</div>
              ) : (initiatives.data?.items.length ?? 0) === 0 ? (
                <div className={styles.columnEmpty}>No initiative pursues this objective.</div>
              ) : (
                initiatives.data!.items.map(initiative => (
                  <div key={initiative._uid} className={`${styles.row} ${styles.rowStatic}`}>
                    <span className={styles.name}>
                      <EntityHoverCard entityId={initiative._uid}>
                        {initiative._name}
                      </EntityHoverCard>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="orphans">
          <div className={styles.orphanLabel}>
            Capabilities with no strategy link{' '}
            <span className="dim">({orphanCapabilities.length})</span>
          </div>
          <Table.Root scroll stickyHeader>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Capability</Table.HeaderCell>
                <Table.HeaderCell>Path</Table.HeaderCell>
                <Table.HeaderCell>Owner</Table.HeaderCell>
                <Table.HeaderCell>Level</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {orphanCapabilities.length === 0 ? (
                <Table.EmptyRow colSpan={4}>
                  {capabilities.isLoading
                    ? 'Loading capabilities…'
                    : 'Every capability is referenced by an objective.'}
                </Table.EmptyRow>
              ) : (
                orphanCapabilities.map(entity => (
                  <Table.Row key={entity._uid} onClick={() => openCapability(entity._publicId)}>
                    <Table.NameCell
                      title={
                        <EntityHoverCard entityId={entity._uid}>{entity._name}</EntityHoverCard>
                      }
                      subtitle={entity._publicId}
                    />
                    <Table.Cell className="dim">{ancestorPath(entity._uid) || '—'}</Table.Cell>
                    <Table.Cell>{entity._owner?.name ?? <span className="dim">—</span>}</Table.Cell>
                    <Table.Cell>
                      {strOrNull(entity.capability_level) ?? <span className="dim">—</span>}
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Tabs.Content>
      </Tabs.Root>

      {capabilityId && (
        <CapabilityDrawer
          workspaceSlug={workspaceSlug}
          capabilityId={capabilityId}
          strategyConfig={strategyConfig}
          onClose={closeCapability}
          onOpenCapability={openCapability}
        />
      )}
    </main>
  );
};
