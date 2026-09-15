import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { Drawer } from '../../../components/Drawer';
import { useRelations } from '../../../hooks/useRelations';
import { entitiesQuery, entityDetailQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatDate } from '../../../utils/dateFormat';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';
import { RISK_RAIL_PATHS, RISK_CONTROLS_ID } from '../riskComplianceSections';
import { useControlCoverageRollups } from '../useControlCoverageRollups';
import { useRiskCoverageRollups } from '../useRiskCoverageRollups';
import { useAssetCoverageRollups } from '../useAssetCoverageRollups';
import { useControlFrameworks } from '../useControlFrameworks';
import { COVERAGE_BAND_COLOR } from '../riskCoverage';
import { riskFieldValue } from '../riskFieldDisplay';
import { Chip } from '../../../components/Chip';
import type { ControlsSearchParams } from '../../../routes/searchParams';
import { ControlDrawer } from './ControlDrawer';
import { RiskDrawer } from './RiskDrawer';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './RiskComplianceControlsScreen.module.css';

/**
 * Minimal in-situ peek for an arbitrary information asset (any entity schema, per `risk-affects`'
 * `outSymSchemaIds: 'any'`) opened from the Coverage view's "coverage by information asset" panel
 * — no dedicated Asset entity/drawer exists, so this just shows identity plus a link out, mirroring
 * every other drawer's `Drawer` shell and "Open record in Entities" footer button
 * (`RiskDrawer.tsx`, `ControlDrawer.tsx`). Kept local to this screen rather than promoted to a
 * shared component since nothing else in the app needs to peek at an arbitrary entity yet.
 */
const AssetDrawer = ({
  workspaceSlug,
  assetId,
  onClose
}: {
  workspaceSlug: string;
  assetId: string;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const asset = useQuery(entityDetailQuery(workspaceSlug, assetId));

  if (asset.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading asset…</div>
      </Drawer>
    );
  }
  if (asset.isError || !asset.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This asset is unavailable.</div>
      </Drawer>
    );
  }

  const entity = asset.data;
  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={<Chip tone="ghost">{entity._schema.name}</Chip>}
      footer={
        <Button
          variant="primary"
          onClick={() =>
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          }
        >
          Open record in Entities
        </Button>
      }
    >
      <span className="dim">
        Affects risks shown on this page — open the full record for its attributes and links.
      </span>
    </Drawer>
  );
};

type SortKey = 'coverage' | 'risksMitigated' | 'lastVerified' | 'name';

const compareNullable = (a: number | string | null, b: number | string | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * The Controls library: search, sort (coverage / risks mitigated / last verified / name), and
 * facets (type, effectiveness, framework) delivered by `RiskComplianceSidebar`'s
 * `ControlsSidebarContent`, plus a Coverage roll-up view — three stat tiles (Effective, Never
 * tested, Uncontrolled risks), a "coverage by risk" bar-list (weakest first), and a "coverage by
 * information asset" table — mirrors the design reference's `RCControls`/`RCCoverage`
 * (`rc-views.jsx`) and this codebase's own `RiskComplianceRisksScreen.tsx` register/matrix
 * toggle. Opens the shared `ControlDrawer` on row click, deep-linkable at
 * `risk-compliance/controls/$controlId`. The Coverage view's own rows (Risks, information
 * assets) open their drawers in-situ over this same page too, via local state rather than
 * navigation — see `openRiskId`/`openAssetId` below.
 *
 * The issue's design language ("family, type, automation, effectiveness, owner, frequency,
 * last/next test") doesn't fully match the shipped schema, which only gives Control
 * `control_type`/`design_effectiveness`/`operating_effectiveness`/`last_verified` — per #3279's
 * "adapt to the shipped schema rather than reworking it" decision (same one #3280 followed for
 * Risks' "next review"/"reference"), `control_type` stands in for both family and type, and
 * automation/owner/frequency/next-test have no analog and are simply not shown. Coverage and
 * Risks mitigated are synthesized (not in the shipped schema) from the `risk-control` relation,
 * the same way Risks' own Coverage column is.
 */
export const RiskComplianceControlsScreen = () => {
  const { workspaceSlug, controlId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    controlId?: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ControlsSearchParams;
  // The Coverage view's Risk/asset drawers open in-situ over this same page rather than
  // navigating to the Risks section or the generic entity view — unlike the Library view's
  // `ControlDrawer` (deep-linkable via the `$controlId` route param), these are local component
  // state, since there's no `/controls` route pattern for a Risk or arbitrary-entity id.
  const [openRiskId, setOpenRiskId] = useState<string | null>(null);
  const [openAssetId, setOpenAssetId] = useState<string | null>(null);
  const q = search.q ?? '';
  const view = search.view ?? 'library';
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const riskConfig = resolveRiskComplianceConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const controlSchema = schemas.data?.find(schema => schema.id === riskConfig?.controlSchemaId);
  const riskSchema = schemas.data?.find(schema => schema.id === riskConfig?.riskSchemaId);

  // Fixed relations on Control's own typedRelation fields, not capability bindings — read their
  // real, per-workspace relation schema ids off those fields, mirroring `ControlDrawer.tsx`.
  const mitigatedRisksField = controlSchema?.fields.find(field => field.id === 'mitigated_risks');
  const riskControlRelationSchemaId =
    mitigatedRisksField?.type === 'typedRelation' ? mitigatedRisksField.relationSchemaId : null;
  const satisfiedRequirementsField = controlSchema?.fields.find(
    field => field.id === 'satisfied_requirements'
  );
  const controlRequirementRelationSchemaId =
    satisfiedRequirementsField?.type === 'typedRelation'
      ? satisfiedRequirementsField.relationSchemaId
      : null;
  const affectedEntitiesField = riskSchema?.fields.find(field => field.id === 'affected_entities');
  const riskAffectsRelationSchemaId =
    affectedEntitiesField?.type === 'typedRelation' ? affectedEntitiesField.relationSchemaId : null;
  const protectedEntitiesField = controlSchema?.fields.find(
    field => field.id === 'protected_entities'
  );
  const controlAffectsRelationSchemaId =
    protectedEntitiesField?.type === 'typedRelation'
      ? protectedEntitiesField.relationSchemaId
      : null;

  const controls = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: riskConfig?.controlSchemaId ?? undefined, view: 'full', limit: 500 },
      riskConfig?.controlSchemaId != null
    )
  );
  const allItems = controls.data?.items ?? [];
  const coverage = useControlCoverageRollups(workspaceSlug, riskControlRelationSchemaId);
  const frameworks = useControlFrameworks(
    workspaceSlug,
    controlRequirementRelationSchemaId,
    riskConfig?.complianceRequirementSchemaId ?? null
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allItems.filter(entity => {
      if (needle && !`${entity._name} ${entity._publicId}`.toLowerCase().includes(needle)) {
        return false;
      }
      if (search.type && entity.control_type !== search.type) return false;
      if (search.effectiveness && entity.operating_effectiveness !== search.effectiveness) {
        return false;
      }
      if (search.framework) {
        const names = frameworks.frameworkNamesByControlId.get(entity._uid);
        if (!names?.has(search.framework)) return false;
      }
      return true;
    });
  }, [
    allItems,
    q,
    search.type,
    search.effectiveness,
    search.framework,
    frameworks.frameworkNamesByControlId
  ]);

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    coverage: (a, b) =>
      compareNullable(
        coverage.byId.get(a._uid)?.rcCoverage ?? null,
        coverage.byId.get(b._uid)?.rcCoverage ?? null
      ),
    risksMitigated: (a, b) =>
      -compareNullable(
        coverage.riskCountById.get(a._uid) ?? 0,
        coverage.riskCountById.get(b._uid) ?? 0
      ),
    lastVerified: (a, b) =>
      compareNullable(
        typeof a.last_verified === 'string' ? a.last_verified : null,
        typeof b.last_verified === 'string' ? b.last_verified : null
      ),
    name: (a, b) => a._name.localeCompare(b._name)
  };
  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, SortKey>(filtered, comparators, {
    key: 'coverage',
    dir: 'asc'
  });

  // The "coverage by risk" and "coverage by information asset" panels below are over every live
  // Risk/asset in the workspace, independent of the Library view's own type/effectiveness/
  // framework facets — mirrors the design reference's `RCCoverage` (`rc-views.jsx`), whose
  // `byRisk`/`byAsset` roll-ups read the full `RC_RISKS`/`RC_ASSETS` sets, not the filtered
  // `rows` prop (that prop only feeds the stat tiles above them — see `filtered` reuse below).
  const risks = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: riskConfig?.riskSchemaId, view: 'full', limit: 500 },
      view === 'coverage' && riskConfig != null
    )
  );
  const riskCoverage = useRiskCoverageRollups(
    workspaceSlug,
    view === 'coverage' ? riskControlRelationSchemaId : null
  );
  // Raw relations behind the coverage rollup, to list each weakest risk's mitigating Control
  // names (or "no control") next to its bar — same `{ schemaId, limit: 1000 }` filters as
  // `useRiskCoverageRollups`'s own internal fetch, so this dedupes against that query's cache
  // rather than firing a second network request.
  const riskControlRelations = useRelations(
    workspaceSlug,
    { schemaId: riskControlRelationSchemaId ?? undefined, limit: 1000 },
    { enabled: view === 'coverage' && !!riskControlRelationSchemaId }
  );
  const controlNamesByRiskId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const relation of riskControlRelations.data) {
      const names = map.get(relation._in.id) ?? [];
      names.push(relation._out.name);
      map.set(relation._in.id, names);
    }
    return map;
  }, [riskControlRelations.data]);
  // "Live" excludes closed risks, mirroring the design reference's `RC_RISKS.filter(r => r.status
  // !== "Closed")` — a closed risk's coverage is no longer actionable.
  const liveRisks = useMemo(
    () => (risks.data?.items ?? []).filter(entity => entity.status !== 'closed'),
    [risks.data]
  );
  const weakestRisks = useMemo(
    () =>
      [...liveRisks].sort((a, b) =>
        compareNullable(
          riskCoverage.byId.get(a._uid)?.rcCoverage ?? null,
          riskCoverage.byId.get(b._uid)?.rcCoverage ?? null
        )
      ),
    [liveRisks, riskCoverage.byId]
  );
  const assetCoverage = useAssetCoverageRollups(
    workspaceSlug,
    view === 'coverage' ? riskAffectsRelationSchemaId : null,
    view === 'coverage' ? controlAffectsRelationSchemaId : null
  );
  const weakestAssets = useMemo(
    () => [...assetCoverage.items].sort((a, b) => a.controlCount - b.controlCount),
    [assetCoverage.items]
  );
  // The stat tiles above the two roll-up panels DO respect the Library view's current filters —
  // the design reference passes its own filtered `rows` into `RCCoverage` for exactly these
  // three stats, unlike the panels below them.
  const uncontrolledRiskCount = useMemo(
    () => liveRisks.filter(r => (riskCoverage.byId.get(r._uid)?.rcCoverage ?? null) == null).length,
    [liveRisks, riskCoverage.byId]
  );

  const openControl = (id: string) =>
    navigate({
      to: `${RISK_RAIL_PATHS[RISK_CONTROLS_ID]}/$controlId`,
      params: { workspaceSlug, controlId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeControl = () =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_CONTROLS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });
  const patchSearch = (patch: Partial<ControlsSearchParams>) =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_CONTROLS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading risk & compliance…</div>;
  }
  if (!riskConfig) {
    return (
      <div className={styles.empty}>
        Risk & Compliance is not enabled. Configure the risk-compliance capability in workspace
        settings.
      </div>
    );
  }
  if (!riskConfig.controlSchemaId) {
    return <div className={styles.empty}>No Control entity schema is bound to this workspace.</div>;
  }

  return (
    <div className={styles.screen}>
      <Title title="Controls" chips={!controls.isLoading && <span>{filtered.length}</span>} />

      <div className={filterStyles.toolbar}>
        <ToggleButtonGroup.Root
          type="single"
          aria-label="Controls view"
          value={view}
          onChange={value => {
            if (value)
              patchSearch({ view: value === 'library' ? undefined : (value as 'coverage') });
          }}
        >
          <ToggleButtonGroup.Item value="library">Library</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="coverage">Coverage</ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>
        {view === 'library' && (
          <>
            <SearchInput
              size="sm"
              className={filterStyles.searchInline}
              value={q}
              placeholder="Search controls by name…"
              aria-label="Search controls"
              onChange={value => patchSearch({ q: value || undefined })}
              onClear={() => patchSearch({ q: undefined })}
            />
            <div style={{ marginLeft: 'auto' }}>
              <FilterDropdown
                label="Sort"
                value={sort?.key ?? 'coverage'}
                onChange={value => value !== sort?.key && toggleSort(value as SortKey)}
                options={[
                  { value: 'coverage', label: 'Coverage' },
                  { value: 'risksMitigated', label: 'Risks mitigated' },
                  { value: 'lastVerified', label: 'Last verified' },
                  { value: 'name', label: 'Name' }
                ]}
              />
            </div>
          </>
        )}
      </div>

      {view === 'coverage' ? (
        <>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <div className={styles.tileLabel}>Effective</div>
              <div className={styles.tileValue}>
                {filtered.filter(c => c.operating_effectiveness === 'effective').length} of{' '}
                {filtered.length}
              </div>
              <div className={styles.tileSub}>latest test result</div>
            </div>
            <div className={styles.tile}>
              <div className={styles.tileLabel}>Never tested</div>
              <div className={styles.tileValue}>
                {filtered.filter(c => typeof c.last_verified !== 'string').length}
              </div>
              <div className={styles.tileSub}>no test on record</div>
            </div>
            <div className={styles.tile}>
              <div className={styles.tileLabel}>Uncontrolled risks</div>
              <div
                className={styles.tileValue}
                style={uncontrolledRiskCount ? { color: COVERAGE_BAND_COLOR.uncovered } : undefined}
              >
                {uncontrolledRiskCount}
              </div>
              <div className={styles.tileSub}>no control linked</div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Coverage by risk</span>
              <span className="dim mono">weakest first</span>
            </div>
            {weakestRisks.length === 0 ? (
              <div className={styles.empty}>
                {risks.isLoading ? 'Loading risks…' : 'No risks yet.'}
              </div>
            ) : (
              <div className={styles.covStack}>
                {weakestRisks.map(entity => {
                  const entityCoverage = riskCoverage.byId.get(entity._uid);
                  const band = entityCoverage?.rcBand ?? 'uncovered';
                  const pct = entityCoverage?.rcCoverage ?? 0;
                  const controlNames = controlNamesByRiskId.get(entity._uid) ?? [];
                  return (
                    <button
                      type="button"
                      key={entity._uid}
                      className={styles.covRow}
                      onClick={() => setOpenRiskId(entity._publicId)}
                    >
                      <span className={styles.covName}>
                        <span className={styles.covTitle}>{entity._name}</span>
                        <span className={styles.covSub}>
                          {entity._publicId} · residual{' '}
                          {typeof entity.residual_risk_score === 'number'
                            ? entity.residual_risk_score
                            : '—'}{' '}
                          · {controlNames.length ? controlNames.join(', ') : 'no control'}
                        </span>
                      </span>
                      <span className={styles.covTrack}>
                        <span
                          className={styles.covFill}
                          style={{
                            width: `${Math.max(2, pct)}%`,
                            background: COVERAGE_BAND_COLOR[band]
                          }}
                        />
                      </span>
                      <span className={styles.covPct} style={{ color: COVERAGE_BAND_COLOR[band] }}>
                        {Math.round(pct)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Coverage by information asset</span>
              <span className="dim mono">{weakestAssets.length} assets</span>
            </div>
            <Table.Root scroll stickyHeader bordered={false}>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Asset</Table.HeaderCell>
                  <Table.HeaderCell align={'right'}>Risks</Table.HeaderCell>
                  <Table.HeaderCell align={'right'}>Controls</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {weakestAssets.length === 0 ? (
                  <Table.EmptyRow colSpan={3}>
                    {assetCoverage.isLoading ? 'Loading assets…' : 'No affected assets linked.'}
                  </Table.EmptyRow>
                ) : (
                  weakestAssets.map(asset => (
                    <Table.Row key={asset.assetId} onClick={() => setOpenAssetId(asset.assetId)}>
                      <Table.NameCell title={asset.assetName} />
                      <Table.Cell numeric>{asset.riskCount}</Table.Cell>
                      <Table.Cell
                        numeric
                        style={
                          !asset.controlCount ? { color: COVERAGE_BAND_COLOR.uncovered } : undefined
                        }
                      >
                        {asset.controlCount || 'none'}
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </div>
        </>
      ) : (
        <Table.Root scroll stickyHeader>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Effectiveness</Table.HeaderCell>
              <Table.SortableHeaderCell sortKey="coverage" sort={sort} onSort={toggleSort}>
                Coverage
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="risksMitigated" sort={sort} onSort={toggleSort}>
                Risks mitigated
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="lastVerified" sort={sort} onSort={toggleSort}>
                Last verified
              </Table.SortableHeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sorted.length === 0 ? (
              <Table.EmptyRow colSpan={6}>
                {controls.isLoading ? 'Loading controls…' : 'No controls match these filters.'}
              </Table.EmptyRow>
            ) : (
              sorted.map(entity => {
                const entityCoverage = coverage.byId.get(entity._uid);
                return (
                  <Table.Row key={entity._uid} onClick={() => openControl(entity._publicId)}>
                    <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                    <Table.Cell>{riskFieldValue(controlSchema, entity, 'control_type')}</Table.Cell>
                    <Table.Cell>
                      {riskFieldValue(controlSchema, entity, 'operating_effectiveness')}
                    </Table.Cell>
                    <Table.Cell>
                      {entityCoverage?.rcBand ? (
                        <Chip dot={COVERAGE_BAND_COLOR[entityCoverage.rcBand]} tone="ghost">
                          {entityCoverage.rcCoverage?.toFixed(0)}%
                        </Chip>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell numeric>{coverage.riskCountById.get(entity._uid) ?? 0}</Table.Cell>
                    <Table.Cell>
                      {typeof entity.last_verified === 'string'
                        ? formatDate(entity.last_verified)
                        : '—'}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      )}

      {controlId && (
        <ControlDrawer
          workspaceSlug={workspaceSlug}
          controlId={controlId}
          riskConfig={riskConfig}
          onClose={closeControl}
        />
      )}
      {openRiskId && (
        <RiskDrawer
          workspaceSlug={workspaceSlug}
          riskId={openRiskId}
          riskConfig={riskConfig}
          onClose={() => setOpenRiskId(null)}
        />
      )}
      {openAssetId && (
        <AssetDrawer
          workspaceSlug={workspaceSlug}
          assetId={openAssetId}
          onClose={() => setOpenAssetId(null)}
        />
      )}
    </div>
  );
};
