import { useMemo } from 'react';
import { useParams, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Title } from '../../../components/Title';
import { Table } from '../../../components/table/Table';
import { EntityHoverCard } from '../../../components/EntityHoverCard';
import { useEntityTree } from '../../../hooks/useEntities';
import { useRelations } from '../../../hooks/useRelations';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { resolveStrategyModelConfig, resolveStrategyViewConfig } from '../strategyQueries';
import { useCapabilityRollups, type CapabilityTableRollup } from '../useCapabilityRollups';
import { fieldLabel } from '../capabilityFieldDisplay';
import { CapabilityDrawer } from './CapabilityDrawer';
import { CapabilityRollupValue, displayIsNumeric } from './CapabilityRollupValue';
import { MeasureProgressBar } from './MeasureProgressBar';
import { STRATEGY_RAIL_PATHS, STRATEGY_STRATEGY_ID } from '../strategySections';
import type { StrategySearchParams } from '../../../routes/searchParams';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import styles from './StrategyStrategyScreen.module.css';

const STRATEGY_ROUTE = STRATEGY_RAIL_PATHS[STRATEGY_STRATEGY_ID];

const strOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

// A `reference` schema field is stored (and returned by the `full` projection) as an array of
// entity ids — occasionally as `{ id }` objects. Normalizes both to a flat id list. The strategy
// panels join these client-side rather than via `conditions` because the entity list's
// `op: 'in'` filter does not currently match inside a JSON-array `reference` column.
const referenceIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'id' in item) {
        const id = (item as { id: unknown }).id;
        return typeof id === 'string' ? id : '';
      }
      return '';
    })
    .filter(Boolean);
};

// `strategy-status` enum values (`schemaTemplates.ts`): draft | active | achieved | abandoned.
// Coloured with this app's real severity tokens (`packages/main/src/tokens.css`) — there is no
// per-status palette like the design reference's `BCM_STATUS_TONE`.
const STATUS_TONE: Record<string, string> = {
  active: 'var(--accent-fg)',
  achieved: 'var(--green)',
  abandoned: 'var(--error-fg, #e05252)',
  draft: 'var(--text-muted)'
};

const EMPTY_ROLLUP: CapabilityTableRollup = { values: {}, currency: {}, appsCount: null };

const StatusChip = ({ status }: { status: unknown }) => {
  const value = strOrNull(status);
  if (!value) return null;
  return (
    <span className={styles.chip} style={{ color: STATUS_TONE[value] ?? 'var(--text-muted)' }}>
      {value}
    </span>
  );
};

/**
 * Strategy section: scoped to one objective at a time (chosen from the primary sidebar's
 * objective list, or the `objective` search param, defaulting to the first objective). Shows the
 * selected objective in a header, then its Outcomes, Initiatives, and Measures, plus a
 * "Capabilities this objective depends on" roll-up table. Measures render a
 * baseline → current → target progress bar over the `measure` schema's `baseline` / `current` /
 * `target_value` fields. Adapted from the design reference's `BCMStrategy` (`bcm-views.jsx`),
 * with sidebar navigation in place of its objective-card strip.
 *
 * The Outcomes and Initiatives panels present the same fields as the seeded
 * `strategy-objectives-table` / `strategy-initiatives-table` template views; surfacing those
 * saved views directly (an "Open in Entities" affordance) is a follow-up, mirroring how
 * `StrategyTraceabilityScreen` deferred the `strategy-traceability` matrix view to #3212.
 */
export const StrategyStrategyScreen = () => {
  const { workspaceSlug, capabilityId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    capabilityId?: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as StrategySearchParams;

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const strategyConfig = resolveStrategyModelConfig(configurations.data);
  const enabled = strategyConfig != null;
  const schemas = useSchemas(workspaceSlug);
  const businessCapabilitySchema = schemas.data?.find(
    schema => schema.id === strategyConfig?.businessCapabilitySchemaId
  );
  const view = resolveStrategyViewConfig(configurations.data, businessCapabilitySchema);
  // The depends-on table reuses the first few configured roll-up table columns, for consistency
  // with the Capabilities table.
  const dependsOnColumns = view.tableColumns.flatMap(column =>
    column.kind === 'field' && column.hasRollup ? [column] : []
  ).slice(0, 3);

  // `view: 'full'` (not 'summary') so the selected-objective header can show the objective's
  // `description` — a schema `longtext` field the summary projection omits.
  const objectives = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.objectiveSchemaId ?? null, view: 'full', limit: 1000 },
      enabled
    )
  );

  const objectiveList = objectives.data?.items ?? [];
  const selectedObjectiveId = search.objective ?? objectiveList[0]?._uid ?? null;
  const selectedObjective = objectiveList.find(o => o._uid === selectedObjectiveId) ?? null;

  // objective (`_in`) → capability (`_out`), same relation shape as `StrategyTraceabilityScreen`.
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

  // `view: 'full'` so the roll-up hook can read each capability's own `maturity`/`gap`/etc. as the
  // no-children fallback (see `useCapabilityRollups`), and so the depends-on table can resolve a
  // capability's `_publicId` for the drawer route.
  const capabilities = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.businessCapabilitySchemaId ?? null, view: 'full', limit: 1000 },
      enabled
    )
  );
  const tree = useEntityTree(
    workspaceSlug,
    { schemaId: strategyConfig?.businessCapabilitySchemaId ?? undefined },
    enabled
  );

  // Outcomes / initiatives / measures are fetched whole (`view: 'full'` for their `objectives` /
  // `outcomes` reference arrays) and joined to the selected objective in memory — see
  // `referenceIds`. The strategy schema pack is small (a handful of each), so `limit: 1000`
  // covers it comfortably.
  const outcomes = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.outcomeSchemaId ?? null, view: 'full', limit: 1000 },
      enabled
    )
  );
  const initiatives = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.initiativeSchemaId ?? null, view: 'full', limit: 1000 },
      enabled
    )
  );
  const measures = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.measureSchemaId ?? null, view: 'full', limit: 1000 },
      enabled
    )
  );

  const objectiveOutcomes = useMemo(
    () =>
      selectedObjectiveId == null
        ? []
        : (outcomes.data?.items ?? []).filter(outcome =>
            referenceIds(outcome.objectives).includes(selectedObjectiveId)
          ),
    [outcomes.data, selectedObjectiveId]
  );
  const objectiveInitiatives = useMemo(
    () =>
      selectedObjectiveId == null
        ? []
        : (initiatives.data?.items ?? []).filter(initiative =>
            referenceIds(initiative.objectives).includes(selectedObjectiveId)
          ),
    [initiatives.data, selectedObjectiveId]
  );
  const objectiveOutcomeIds = useMemo(
    () => new Set(objectiveOutcomes.map(outcome => outcome._uid)),
    [objectiveOutcomes]
  );
  const objectiveMeasures = useMemo(
    () =>
      objectiveOutcomeIds.size === 0
        ? []
        : (measures.data?.items ?? []).filter(measure =>
            referenceIds(measure.outcomes).some(id => objectiveOutcomeIds.has(id))
          ),
    [measures.data, objectiveOutcomeIds]
  );

  // capability id → count of objectives supporting it, for the card meta.
  const capabilityCountByObjective = useMemo(() => {
    const byObjective = new Map<string, number>();
    for (const relation of objectiveSupportsCapability.data) {
      byObjective.set(relation._in.id, (byObjective.get(relation._in.id) ?? 0) + 1);
    }
    return byObjective;
  }, [objectiveSupportsCapability.data]);

  // capability (`_in`) → applications / entities (`_out`).
  const applicationsByCapability = useMemo(() => {
    const byCapability = new Map<string, { id: string; name: string }[]>();
    for (const relation of capabilitySupportsEntity.data) {
      const list = byCapability.get(relation._in.id) ?? [];
      list.push({ id: relation._out.id, name: relation._out.name });
      byCapability.set(relation._in.id, list);
    }
    return byCapability;
  }, [capabilitySupportsEntity.data]);

  const dependsOnCapabilityIds = useMemo(() => {
    if (!selectedObjectiveId) return new Set<string>();
    return new Set(
      objectiveSupportsCapability.data
        .filter(relation => relation._in.id === selectedObjectiveId)
        .map(relation => relation._out.id)
    );
  }, [objectiveSupportsCapability.data, selectedObjectiveId]);

  const dependsOnCapabilities = useMemo(
    () =>
      (capabilities.data?.items ?? []).filter(entity => dependsOnCapabilityIds.has(entity._uid)),
    [capabilities.data, dependsOnCapabilityIds]
  );

  const rollups = useCapabilityRollups(
    workspaceSlug,
    strategyConfig?.businessCapabilitySchemaId ?? null,
    strategyConfig?.businessCapabilitySupportsEntityRelationSchemaId ?? null,
    dependsOnCapabilities,
    view.rollups,
    tree.data?.edges ?? []
  );
  const rollupFor = (id: string) => rollups.byId.get(id) ?? EMPTY_ROLLUP;

  // childId → parentId + name lookup, for the depends-on table's Domain (root ancestor) column.
  const parentOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const edge of tree.data?.edges ?? []) map.set(edge.childId, edge.parentId);
    return map;
  }, [tree.data]);
  const nameByUid = useMemo(
    () => new Map((tree.data?.nodes ?? []).map(node => [node._uid, node._name])),
    [tree.data]
  );
  const domainName = (uid: string): string => {
    let current = uid;
    while (parentOf.get(current)) current = parentOf.get(current)!;
    return nameByUid.get(current) ?? '—';
  };

  const openCapability = (id: string) =>
    navigate({
      to: `${STRATEGY_ROUTE}/$capabilityId`,
      params: { workspaceSlug, capabilityId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeCapability = () =>
    navigate({
      to: STRATEGY_ROUTE,
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
          title="Strategy"
          description="Objectives, the outcomes they promise, the initiatives funding them, and the measures that prove it."
        />
      </div>

      {objectiveList.length === 0 ? (
        <div className={styles.selectedObjective}>
          <div className={styles.panelEmpty}>
            {objectives.isLoading ? 'Loading objectives…' : 'No objectives yet.'}
          </div>
        </div>
      ) : selectedObjective == null ? (
        <div className={styles.selectedObjective}>
          <div className={styles.panelEmpty}>Select an objective from the sidebar.</div>
        </div>
      ) : (
        <div className={styles.selectedObjective}>
          <div className={styles.selectedObjectiveLabel}>Objective</div>
          <div className={styles.selectedObjectiveName}>
            <EntityHoverCard entityId={selectedObjective._uid}>
              {selectedObjective._name}
            </EntityHoverCard>
          </div>
          <div className={styles.selectedObjectiveMeta}>
            <StatusChip status={selectedObjective.status} />
            {strOrNull(selectedObjective.target_date) && (
              <span className={styles.horizon}>{strOrNull(selectedObjective.target_date)}</span>
            )}
            {selectedObjective._owner && <span>{selectedObjective._owner.name}</span>}
            <span>
              {capabilityCountByObjective.get(selectedObjective._uid) ?? 0}{' '}
              {(capabilityCountByObjective.get(selectedObjective._uid) ?? 0) === 1
                ? 'capability'
                : 'capabilities'}
            </span>
          </div>
          {strOrNull(selectedObjective.description) && (
            <div className={styles.selectedObjectiveDescription}>
              {strOrNull(selectedObjective.description)}
            </div>
          )}
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Outcomes</span>
            <span>{objectiveOutcomes.length}</span>
          </div>
          {selectedObjectiveId == null ? (
            <div className={styles.panelEmpty}>Select an objective.</div>
          ) : outcomes.isLoading ? (
            <div className={styles.panelEmpty}>Loading…</div>
          ) : objectiveOutcomes.length === 0 ? (
            <div className={styles.panelEmpty}>No outcome promised by this objective.</div>
          ) : (
            <div className={styles.stack}>
              {objectiveOutcomes.map(outcome => (
                <div key={outcome._uid} className={styles.item}>
                  <div className={styles.itemName}>
                    <EntityHoverCard entityId={outcome._uid}>{outcome._name}</EntityHoverCard>
                  </div>
                  {strOrNull(outcome.description) && (
                    <div className={styles.itemMeta}>{strOrNull(outcome.description)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Initiatives</span>
            <span>{objectiveInitiatives.length}</span>
          </div>
          {selectedObjectiveId == null ? (
            <div className={styles.panelEmpty}>Select an objective.</div>
          ) : initiatives.isLoading ? (
            <div className={styles.panelEmpty}>Loading…</div>
          ) : objectiveInitiatives.length === 0 ? (
            <div className={styles.panelEmpty}>No initiative pursues this objective.</div>
          ) : (
            <div className={styles.stack}>
              {objectiveInitiatives.map(initiative => (
                <div key={initiative._uid} className={styles.item}>
                  <div className={styles.itemName}>
                    <EntityHoverCard entityId={initiative._uid}>{initiative._name}</EntityHoverCard>
                  </div>
                  <div className={styles.itemMeta}>
                    <StatusChip status={initiative.status} />
                    {strOrNull(initiative.description) && (
                      <span>{strOrNull(initiative.description)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Measures</span>
            <span>{objectiveMeasures.length}</span>
          </div>
          {selectedObjectiveId == null ? (
            <div className={styles.panelEmpty}>Select an objective.</div>
          ) : measures.isLoading || outcomes.isLoading ? (
            <div className={styles.panelEmpty}>Loading…</div>
          ) : objectiveOutcomeIds.size === 0 ? (
            <div className={styles.panelEmpty}>No outcome to measure yet.</div>
          ) : objectiveMeasures.length === 0 ? (
            <div className={styles.panelEmpty}>No measure tracks these outcomes.</div>
          ) : (
            <div className={styles.stack}>
              {objectiveMeasures.map(measure => (
                <div key={measure._uid} className={styles.item}>
                  <div className={styles.itemName}>
                    <EntityHoverCard entityId={measure._uid}>{measure._name}</EntityHoverCard>
                  </div>
                  <MeasureProgressBar
                    baseline={measure.baseline}
                    current={measure.current}
                    target={measure.target_value}
                    unit={measure.unit}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.dependsOn}>
        <div className={styles.dependsOnHeader}>Capabilities this objective depends on</div>
        <Table.Root scroll stickyHeader>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Capability</Table.HeaderCell>
              <Table.HeaderCell>Domain</Table.HeaderCell>
              {dependsOnColumns.map(column => (
                <Table.HeaderCell key={column.fieldId} numeric={displayIsNumeric(column.display)}>
                  {column.header ?? fieldLabel(businessCapabilitySchema, column.fieldId)}
                </Table.HeaderCell>
              ))}
              <Table.HeaderCell>Applications</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {selectedObjectiveId == null || dependsOnCapabilities.length === 0 ? (
              <Table.EmptyRow colSpan={3 + dependsOnColumns.length}>
                {capabilities.isLoading || objectiveSupportsCapability.isLoading
                  ? 'Loading capabilities…'
                  : 'This objective supports no capability.'}
              </Table.EmptyRow>
            ) : (
              dependsOnCapabilities.map((entity: EntityRecord) => {
                const rollup = rollupFor(entity._uid);
                const apps = applicationsByCapability.get(entity._uid) ?? [];
                return (
                  <Table.Row key={entity._uid} onClick={() => openCapability(entity._publicId)}>
                    <Table.NameCell
                      title={
                        <EntityHoverCard entityId={entity._uid}>{entity._name}</EntityHoverCard>
                      }
                      subtitle={entity._publicId}
                    />
                    <Table.Cell className="dim">{domainName(entity._uid)}</Table.Cell>
                    {dependsOnColumns.map(column => (
                      <Table.Cell key={column.fieldId} numeric={displayIsNumeric(column.display)}>
                        <CapabilityRollupValue
                          value={rollup.values[column.fieldId] ?? null}
                          currency={rollup.currency[column.fieldId] ?? null}
                          display={column.display}
                          format={column.format}
                          fieldId={column.fieldId}
                          schema={businessCapabilitySchema}
                        />
                      </Table.Cell>
                    ))}
                    <Table.Cell className="dim">
                      {apps.length === 0 ? '—' : apps.map(app => app.name).join(', ')}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      </div>

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
