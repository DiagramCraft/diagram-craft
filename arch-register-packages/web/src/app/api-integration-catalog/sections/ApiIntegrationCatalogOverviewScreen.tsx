import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useRelations } from '../../../hooks/useRelations';
import { useSchemas } from '../../../hooks/useSchemas';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import { useDataFlowConfig } from '../useDataFlowConfig';
import { useApiOperationsCounts } from '../useApiOperationsCounts';
import { useApiEndpointRelations, groupByApiId } from '../apiEndpointRelations';
import { computeApiPairs, computeApiPairCoverage } from '../apiPairCoverage';
import { RESTRICTED_CLASSIFICATIONS } from '../dataFlowRelationDisplay';
import { useApiIntegrationCatalogQueue } from '../apiIntegrationCatalogQueue';
import { IC_APIS_ID, IC_INTEGRATIONS_ID, IC_RAIL_PATHS } from '../apiIntegrationCatalogSections';
import placeholderStyles from './ApiIntegrationCatalogPlaceholderScreen.module.css';
import styles from './ApiIntegrationCatalogOverviewScreen.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';
const MOST_CONSUMED_LIMIT = 6;
const QUEUE_LIMIT = 8;
const AT_RISK_LIMIT = 8;

/**
 * The API & Integration Catalog's landing screen (`sections[0]`, so the app switcher opens here) —
 * a read-only dashboard summarizing the APIs and Integrations sections, each panel linking into the
 * section that owns the full view. Mirrors the Claude Design reference's `ICOverview` (`ic.jsx`) and
 * this codebase's own `../../risk-compliance/sections/RiskComplianceOverviewScreen.tsx` /
 * `../../vendor-management/sections/VendorOverviewScreen.tsx`. Everything here is a client-side
 * roll-up over the same entity/relation queries and hooks the APIs/Integrations sections already
 * use — no bespoke server endpoint and no new logic beyond the queue hook.
 *
 * The design reference's "Detected specification changes" panel (needs breaking-change detection,
 * #2980, unbuilt) and "Last sync run per connector" panel (needs the sync control center, #2982,
 * unbuilt — tracked separately as #3319) are dropped rather than faked, per #3318's scope. The
 * "Needs attention" queue instead reuses the generic governance case-kind machinery the same way
 * Data Stewardship's My Work does (`useApiIntegrationCatalogQueue`, following the concrete pattern
 * in `../data-stewardship/dataStewardshipQueue.ts`) — no new governance primitive.
 *
 * The 4 stat tiles mirror the design reference's `ICStat` tone convention (a value colours red/amber
 * only when it represents something needing attention) rather than plain totals — those totals
 * (published specs / operations / integration relations) move into the `Title` description instead,
 * matching `ic.jsx`'s own split between its eyebrow/sub line and its risk-only `ic-stats`. The tiles
 * reuse the exact same crossing-boundary/restricted-classification/provider-consumer-gap figures
 * `ApiIntegrationCatalogIntegrationsScreen.tsx` already computes and tones for its own tiles.
 */
export const ApiIntegrationCatalogOverviewScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const apiConfig = resolveApiIntegrationCatalogConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const apiSchema = schemas.data?.find(schema => schema.id === apiConfig?.apiSchemaId);

  const apis = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: apiConfig?.apiSchemaId, view: 'full', limit: 500 },
      apiConfig != null
    )
  );
  const allApis = apis.data?.items ?? [];
  const apiIds = useMemo(() => allApis.map(entity => entity._uid), [allApis]);
  const operationsCounts = useApiOperationsCounts(workspaceSlug, apiIds);
  const totalOperations = useMemo(() => {
    let total = 0;
    let known = false;
    for (const count of operationsCounts.byId.values()) {
      if (count == null) continue;
      known = true;
      total += count;
    }
    return known ? total : null;
  }, [operationsCounts.byId]);

  const { providers, consumers } = useApiEndpointRelations(workspaceSlug, apiSchema);
  const consumersByApi = useMemo(() => groupByApiId(consumers), [consumers]);

  const mostConsumed = useMemo(
    () =>
      [...allApis]
        .sort(
          (a, b) =>
            (consumersByApi.get(b._uid)?.length ?? 0) - (consumersByApi.get(a._uid)?.length ?? 0)
        )
        .slice(0, MOST_CONSUMED_LIMIT),
    [allApis, consumersByApi]
  );

  const dataFlowConfig = useDataFlowConfig(workspaceSlug);
  const relations = useRelations(
    workspaceSlug,
    { schemaId: dataFlowConfig.data?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig.data != null }
  );
  const allRelations = relations.data;

  const pairs = useMemo(
    () => computeApiPairs(providers, consumers, allRelations),
    [providers, consumers, allRelations]
  );
  const coverage = useMemo(() => computeApiPairCoverage(pairs), [pairs]);

  const crossingRelations = allRelations.filter(
    relation => relation.cross_boundary === 'cross-boundary'
  );
  const restrictedRelations = allRelations.filter(relation =>
    (RESTRICTED_CLASSIFICATIONS as readonly string[]).includes(
      relation.data_classification as string
    )
  );
  const highlySensitiveCount = allRelations.filter(
    relation => relation.data_classification === 'highly-sensitive'
  ).length;
  const atRiskRelations = useMemo(() => {
    const byId = new Map(
      [...crossingRelations, ...restrictedRelations].map(relation => [relation._uid, relation])
    );
    return [...byId.values()].slice(0, AT_RISK_LIMIT);
  }, [crossingRelations, restrictedRelations]);

  const queue = useApiIntegrationCatalogQueue(
    workspaceSlug,
    apiConfig?.apiSchemaId ?? null,
    apiConfig != null
  );

  const openApi = (publicId: string) =>
    navigate({
      to: `${IC_RAIL_PATHS[IC_APIS_ID]}/$apiId`,
      params: { workspaceSlug, apiId: publicId },
      search: (previous: Record<string, unknown>) => previous
    });
  const goToIntegrations = (search: Record<string, unknown> = {}) =>
    navigate({
      to: IC_RAIL_PATHS[IC_INTEGRATIONS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...search })
    });

  if (configurations.isLoading) {
    return <div className={placeholderStyles.empty}>Loading API & Integration Catalog…</div>;
  }
  if (!apiConfig) {
    return (
      <div className={placeholderStyles.empty}>
        API & Integration Catalog is not enabled. Configure the API specification capability in
        workspace settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title
        title="Overview"
        chips={!apis.isLoading && <span>{allApis.length}</span>}
        description={`${allApis.length} published specification${allApis.length === 1 ? '' : 's'}, ${totalOperations ?? '—'} operations and ${dataFlowConfig.data ? allRelations.length : '—'} integration relations.`}
      />

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Needs attention</div>
          <div
            className={styles.tileValue}
            style={queue.items.length ? { color: WARN } : undefined}
          >
            {queue.items.length}
          </div>
          <div className={styles.tileSub}>open change &amp; deprecation cases</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Crossing a boundary</div>
          <div
            className={styles.tileValue}
            style={crossingRelations.length ? { color: WARN } : undefined}
          >
            {dataFlowConfig.data ? crossingRelations.length : '—'}
          </div>
          <div className={styles.tileSub}>
            {dataFlowConfig.data
              ? 'source and destination regions differ'
              : 'Data Flow not configured'}
          </div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Carrying restricted data</div>
          <div
            className={styles.tileValue}
            style={restrictedRelations.length ? { color: DANGER } : undefined}
          >
            {dataFlowConfig.data ? restrictedRelations.length : '—'}
          </div>
          <div className={styles.tileSub}>
            {dataFlowConfig.data
              ? `${highlySensitiveCount} highly sensitive`
              : 'Data Flow not configured'}
          </div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Provider/consumer gaps</div>
          <div
            className={styles.tileValue}
            style={coverage.gapPairs ? { color: DANGER } : undefined}
          >
            {dataFlowConfig.data ? coverage.gapPairs : '—'}
          </div>
          <div className={styles.tileSub}>
            {dataFlowConfig.data
              ? `${coverage.coveredPairs} of ${coverage.applicablePairs} covered`
              : 'Data Flow not configured'}
          </div>
        </div>
      </div>

      <div className={styles.two}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Needs attention</span>
            <span className="dim mono">{queue.items.length}</span>
          </div>
          <div className={styles.stack}>
            {queue.isLoading ? (
              <div className={styles.row}>Loading queue…</div>
            ) : queue.items.length === 0 ? (
              <div className={styles.row}>Nothing awaiting a decision.</div>
            ) : (
              queue.items.slice(0, QUEUE_LIMIT).map(item => (
                <button
                  key={item.case.id}
                  type="button"
                  className={styles.row}
                  onClick={() => openApi(item.api._publicId)}
                >
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{item.api._name}</span>
                    <span className={`${styles.rowSub} dim`}>
                      {caseKindLabel(item.case.caseKind, item.case.payload)}
                    </span>
                  </span>
                  {item.case.dueAt && (
                    <span className="dim mono" style={{ fontSize: 10.5 }}>
                      due {new Date(item.case.dueAt).toLocaleDateString()}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Most consumed APIs</span>
            <button
              type="button"
              className={styles.panelLink}
              onClick={() =>
                navigate({
                  to: IC_RAIL_PATHS[IC_APIS_ID],
                  params: { workspaceSlug },
                  search: (previous: Record<string, unknown>) => previous
                })
              }
            >
              Catalog
            </button>
          </div>
          <div className={styles.stack}>
            {apis.isLoading ? (
              <div className={styles.row}>Loading APIs…</div>
            ) : mostConsumed.length === 0 ? (
              <div className={styles.row}>No APIs registered yet.</div>
            ) : (
              mostConsumed.map(entity => {
                const count = consumersByApi.get(entity._uid)?.length ?? 0;
                const ops = operationsCounts.byId.get(entity._uid);
                return (
                  <button
                    key={entity._uid}
                    type="button"
                    className={styles.row}
                    onClick={() => openApi(entity._publicId)}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowName}>{entity._name}</span>
                      <span className={`${styles.rowSub} dim`}>
                        {ops ?? '—'} operations · {entity._owner?.name ?? 'unowned'}
                      </span>
                    </span>
                    <span className="mono tabular dim">{count}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Integrations needing attention</span>
          <button
            type="button"
            className={styles.panelLink}
            onClick={() => goToIntegrations({ boundary: '1' })}
          >
            All integrations
          </button>
        </div>
        <div className={styles.stack}>
          {!dataFlowConfig.data ? (
            <div className={styles.row}>
              No Data Flow relation is configured for this workspace.
            </div>
          ) : atRiskRelations.length === 0 ? (
            <div className={styles.row}>
              No relation crosses a boundary or carries restricted data.
            </div>
          ) : (
            atRiskRelations.map(relation => {
              const crosses = relation.cross_boundary === 'cross-boundary';
              const restricted = (RESTRICTED_CLASSIFICATIONS as readonly string[]).includes(
                relation.data_classification as string
              );
              return (
                <div key={relation._uid} className={styles.row} style={{ cursor: 'default' }}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>
                      {relation._in.name} → {relation._out.name}
                    </span>
                    <span className={`${styles.rowSub} dim`}>
                      {crosses && restricted
                        ? 'crosses a boundary · restricted data'
                        : crosses
                          ? 'crosses a boundary'
                          : 'restricted data'}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
