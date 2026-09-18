import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useRelations } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { useSchemas } from '../../../hooks/useSchemas';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { relationIds } from '../../../lib/entityEditState';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import { useDataFlowConfig } from '../useDataFlowConfig';
import { relationFieldValue, RESTRICTED_CLASSIFICATIONS } from '../dataFlowRelationDisplay';
import { computeApiPairCoverage, computeApiPairs, type EndpointRef } from '../apiPairCoverage';
import { ApiSpecDrawer } from './ApiSpecDrawer';
import { IntegrationDrawer } from './IntegrationDrawer';
import { ApiPairsTable } from './ApiPairsTable';
import { IC_INTEGRATIONS_ID, IC_RAIL_PATHS } from '../apiIntegrationCatalogSections';
import type { ApiIntegrationCatalogIntegrationsSearchParams } from '../../../routes/searchParams';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import placeholderStyles from './ApiIntegrationCatalogPlaceholderScreen.module.css';
import styles from './ApiIntegrationCatalogIntegrationsScreen.module.css';

const PROVIDERS_FIELD = 'providers';
const CONSUMERS_FIELD = 'consumers';
const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

type SortKey = 'flow' | 'protocol' | 'classification' | 'boundary';

/**
 * The Integrations register: every `Data Flow` relation in the workspace — stat tiles, a sidebar
 * of Protocol/Classification/boundary facets (`IntegrationsSidebarContent` in
 * `ApiIntegrationCatalogSidebar.tsx`), a searchable/sortable table, and a detail drawer — mirroring
 * the Claude Design reference's `ICIntegrations` (`ic-views.jsx`) layout, except the drawer: the
 * design renders the selected relation's detail as an inline panel below the table, but a
 * slide-over drawer keeps the pattern consistent with every other detail panel in this app
 * (`ApiSpecDrawer.tsx`) and its siblings elsewhere (`DatasetDrawer.tsx`, `RiskDrawer.tsx`). Reuses
 * the existing `Data Flow` typed relation (#3065/information-governance) rather than a new
 * integration-relation model.
 *
 * The design's Style/Adapter/Volume/Latency/Health columns, its "relations per adapter" breakdown,
 * and its Health/Adapter sidebar facets have no backing data source anywhere in the codebase and
 * are explicitly out of scope per #3150 ("not an API gateway or runtime observability tool"), so
 * they're dropped — the sidebar facets by Protocol and Classification instead. The design's
 * "+ New relation" action is also dropped — there is no generic quick-create flow pre-filled to a
 * relation schema in this codebase to wire it to (the APIs section's own "Register API" action was
 * dropped for the same reason in #3316).
 *
 * A fifth stat tile and a toolbar toggle (#3340) surface the complementary half of the API join:
 * every `Provides API` × `Consumes API` pairing, and whether each has a matching Data Flow relation
 * between its two endpoints — see `apiPairCoverage.ts` and `ApiPairsTable.tsx`.
 */
export const ApiIntegrationCatalogIntegrationsScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ApiIntegrationCatalogIntegrationsSearchParams;
  const q = search.q ?? '';
  const isPairsView = search.view === 'pairs';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const apiConfig = resolveApiIntegrationCatalogConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const apiSchema = schemas.data?.find(schema => schema.id === apiConfig?.apiSchemaId);

  const dataFlowConfig = useDataFlowConfig(workspaceSlug);
  const relationSchemas = useRelationSchemas(workspaceSlug, dataFlowConfig.data != null);
  const relationSchema = relationSchemas.data?.find(
    candidate => candidate.id === dataFlowConfig.data?.relationSchemaId
  );

  const relations = useRelations(
    workspaceSlug,
    { schemaId: dataFlowConfig.data?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig.data != null }
  );
  const allRelations = relations.data;

  // Endpoint → registered API lookup: resolve the `api` schema's `providers`/`consumers`
  // typed-relation fields to their relation-schema ids (same lookup `ApiSpecDrawer.tsx` does), then
  // fetch those relations workspace-wide. A Data Flow's endpoints are `System` entities, so looking
  // this map up by a flow's `_in.id`/`_out.id` resolves to the API entity that System
  // provides/consumes, if any — mirrors `ApiSpecDrawer`'s `otherEndpoint` pattern without needing
  // the full API entity list.
  const providersField = apiSchema?.fields.find(field => field.id === PROVIDERS_FIELD);
  const providersRelationSchemaId =
    providersField?.type === 'typedRelation' ? providersField.relationSchemaId : null;
  const consumersField = apiSchema?.fields.find(field => field.id === CONSUMERS_FIELD);
  const consumersRelationSchemaId =
    consumersField?.type === 'typedRelation' ? consumersField.relationSchemaId : null;

  const providers = useRelations(
    workspaceSlug,
    { schemaId: providersRelationSchemaId ?? undefined, limit: 500 },
    { enabled: providersRelationSchemaId != null }
  );
  const consumers = useRelations(
    workspaceSlug,
    { schemaId: consumersRelationSchemaId ?? undefined, limit: 500 },
    { enabled: consumersRelationSchemaId != null }
  );

  const apiByEntityId = useMemo(() => {
    const map = new Map<string, EndpointRef>();
    for (const relation of [...providers.data, ...consumers.data]) {
      map.set(relation._in.id, relation._out);
      map.set(relation._out.id, relation._in);
    }
    return map;
  }, [providers.data, consumers.data]);

  const registeredApiFor = (relation: RelationRecord): EndpointRef | null =>
    apiByEntityId.get(relation._in.id) ?? apiByEntityId.get(relation._out.id) ?? null;

  // Provider × consumer pairs for each registered API and their Data Flow coverage (#3340) — reuses
  // the same `providers`/`consumers`/`allRelations` fetched above, no new queries.
  const pairs = useMemo(
    () => computeApiPairs(providers.data, consumers.data, allRelations),
    [providers.data, consumers.data, allRelations]
  );
  const coverage = useMemo(() => computeApiPairCoverage(pairs), [pairs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allRelations.filter(relation => {
      if (search.protocol && relation.protocol !== search.protocol) return false;
      if (search.classification && relation.data_classification !== search.classification) {
        return false;
      }
      if (search.boundary && relation.cross_boundary !== 'cross-boundary') return false;
      if (
        needle &&
        ![
          relation._in.name,
          relation._out.name,
          relationFieldValue(relationSchema, relation, 'protocol'),
          relationFieldValue(relationSchema, relation, 'data_classification')
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [allRelations, q, search.protocol, search.classification, search.boundary, relationSchema]);

  const comparators: Record<SortKey, (a: RelationRecord, b: RelationRecord) => number> = {
    flow: (a, b) => a._in.name.localeCompare(b._in.name),
    protocol: (a, b) =>
      relationFieldValue(relationSchema, a, 'protocol').localeCompare(
        relationFieldValue(relationSchema, b, 'protocol')
      ),
    classification: (a, b) =>
      relationFieldValue(relationSchema, a, 'data_classification').localeCompare(
        relationFieldValue(relationSchema, b, 'data_classification')
      ),
    boundary: (a, b) =>
      (a.cross_boundary === 'cross-boundary' ? 0 : 1) -
      (b.cross_boundary === 'cross-boundary' ? 0 : 1)
  };
  const { sorted, sort, toggleSort } = useTableSort<RelationRecord, SortKey>(
    filtered,
    comparators,
    { key: 'flow', dir: 'asc' }
  );

  const [openRelationId, setOpenRelationId] = useState<string | null>(null);
  const [openApiId, setOpenApiId] = useState<string | null>(null);
  const openRelation = allRelations.find(relation => relation._uid === openRelationId) ?? null;

  const protocolsInUse = useMemo(
    () =>
      [
        ...new Set(
          allRelations.map(relation => relationFieldValue(relationSchema, relation, 'protocol'))
        )
      ].filter(value => value !== '—'),
    [allRelations, relationSchema]
  );

  const crossingCount = allRelations.filter(
    relation => relation.cross_boundary === 'cross-boundary'
  ).length;
  const restrictedCount = allRelations.filter(relation =>
    (RESTRICTED_CLASSIFICATIONS as readonly string[]).includes(
      relation.data_classification as string
    )
  ).length;
  const highlySensitiveCount = allRelations.filter(
    relation => relation.data_classification === 'highly-sensitive'
  ).length;
  const apiLinkedCount = allRelations.filter(relation => registeredApiFor(relation) != null).length;

  const patchSearch = (patch: Partial<ApiIntegrationCatalogIntegrationsSearchParams>) =>
    navigate({
      to: IC_RAIL_PATHS[IC_INTEGRATIONS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  if (configurations.isLoading || dataFlowConfig.isLoading) {
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
  if (!dataFlowConfig.data) {
    return (
      <div className={placeholderStyles.empty}>
        No Data Flow relation is configured for this workspace. Enable the Data Flow relation
        (information governance) to track integrations.
      </div>
    );
  }

  return (
    <div className={placeholderStyles.screen}>
      <Title
        title="Integrations"
        chips={!relations.isLoading && <span>{sorted.length}</span>}
        description="Integration relations between entities: the protocol each flow uses, the data it carries, its classification, and whether it crosses a boundary."
      />

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Relations</div>
          <div className={styles.tileValue}>{allRelations.length}</div>
          <div className={styles.tileSub}>{protocolsInUse.length} protocols in use</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Crossing a boundary</div>
          <div className={styles.tileValue} style={crossingCount ? { color: WARN } : undefined}>
            {crossingCount}
          </div>
          <div className={styles.tileSub}>source and destination regions differ</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Carrying restricted data</div>
          <div className={styles.tileValue} style={restrictedCount ? { color: DANGER } : undefined}>
            {restrictedCount}
          </div>
          <div className={styles.tileSub}>{highlySensitiveCount} highly sensitive</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Linked to a registered API</div>
          <div className={styles.tileValue}>{apiLinkedCount}</div>
          <div className={styles.tileSub}>an endpoint provides or consumes an API</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Provider/consumer gaps</div>
          <div
            className={styles.tileValue}
            style={coverage.gapPairs ? { color: DANGER } : undefined}
          >
            {coverage.gapPairs}
          </div>
          <div className={styles.tileSub}>
            {coverage.coveredPairs} of {coverage.applicablePairs} covered
            {coverage.notApplicablePairs > 0 && ` · ${coverage.notApplicablePairs} n/a (component)`}
          </div>
        </div>
      </div>

      <Tabs.Root
        value={isPairsView ? 'pairs' : 'flows'}
        onValueChange={value => patchSearch({ view: value === 'pairs' ? 'pairs' : undefined })}
      >
        <Tabs.List aria-label="Integrations view">
          <Tabs.Trigger value="flows">Data Flows</Tabs.Trigger>
          <Tabs.Trigger value="pairs">API Usage</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      <div className={filterStyles.toolbar}>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search flows, protocols, classifications…"
          aria-label="Search integrations"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
      </div>

      {isPairsView ? (
        <ApiPairsTable pairs={pairs} q={q} />
      ) : (
        <Table.Root scroll stickyHeader>
          <Table.Head>
            <Table.Row>
              <Table.SortableHeaderCell sortKey="flow" sort={sort} onSort={toggleSort}>
                Flow
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="protocol" sort={sort} onSort={toggleSort}>
                Protocol
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="classification" sort={sort} onSort={toggleSort}>
                Classification
              </Table.SortableHeaderCell>
              <Table.HeaderCell>Carried data</Table.HeaderCell>
              <Table.SortableHeaderCell sortKey="boundary" sort={sort} onSort={toggleSort}>
                Boundary
              </Table.SortableHeaderCell>
              <Table.HeaderCell>API</Table.HeaderCell>
              <Table.HeaderCell>Owner</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sorted.length === 0 ? (
              <Table.EmptyRow colSpan={7}>
                {relations.isLoading
                  ? 'Loading integrations…'
                  : 'No integrations match these filters.'}
              </Table.EmptyRow>
            ) : (
              sorted.map(relation => {
                const crosses = relation.cross_boundary === 'cross-boundary';
                const registeredApi = registeredApiFor(relation);
                const carriedCount = relationIds(relation.data_entities).length;
                return (
                  <Table.Row
                    key={relation._uid}
                    selected={relation._uid === openRelationId}
                    onClick={() => setOpenRelationId(relation._uid)}
                  >
                    <Table.NameCell title={`${relation._in.name} → ${relation._out.name}`} />
                    <Table.Cell className="dim">
                      {relationFieldValue(relationSchema, relation, 'protocol')}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip tone="ghost">
                        {relationFieldValue(relationSchema, relation, 'data_classification')}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="dim">{carriedCount || '—'}</Table.Cell>
                    <Table.Cell>
                      {crosses ? (
                        <Chip tone="ghost" color={WARN}>
                          crosses
                        </Chip>
                      ) : (
                        <span className="dim">internal</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="dim">
                      {registeredApi ? registeredApi.name : '—'}
                    </Table.Cell>
                    <Table.Cell className="dim">{relation._owner?.name ?? '—'}</Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      )}

      {openApiId && apiConfig && (
        <ApiSpecDrawer
          workspaceSlug={workspaceSlug}
          apiId={openApiId}
          apiSchemaId={apiConfig.apiSchemaId}
          onClose={() => setOpenApiId(null)}
        />
      )}
      {!openApiId && openRelation && (
        <IntegrationDrawer
          workspaceSlug={workspaceSlug}
          relation={openRelation}
          relationSchema={relationSchema}
          registeredApi={registeredApiFor(openRelation)}
          onClose={() => setOpenRelationId(null)}
          onOpenApi={apiId => setOpenApiId(apiId)}
        />
      )}
    </div>
  );
};
