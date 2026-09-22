import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatDate } from '../../../utils/dateFormat';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';
import { RISK_RAIL_PATHS, RISK_RISKS_ID } from '../riskComplianceSections';
import { useRiskCoverageRollups } from '../useRiskCoverageRollups';
import { residualRiskBand, RESIDUAL_RISK_BAND_COLOR } from '../residualRiskBand';
import { COVERAGE_BAND_COLOR } from '../riskCoverage';
import { riskFieldValue } from '../riskFieldDisplay';
import type { RisksSearchParams } from '../../../routes/searchParams';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { RiskComplianceMatrix, type RiskComplianceMatrixRisk } from './RiskComplianceMatrix';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './RiskComplianceRisksScreen.module.css';

type SortKey = 'residual' | 'inherent' | 'coverage' | 'nextReview' | 'reference';

const compareNullable = (a: number | string | null, b: number | string | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * The Risks register: search, sort (residual / inherent / coverage / next review / reference),
 * and facets (category, status, owner, outside appetite) delivered by `RiskComplianceSidebar`'s
 * `RisksSidebarContent`, plus the shared 5×5 `RiskComplianceMatrix` (inherent/residual axis
 * toggle). The register and matrix are mutually exclusive views switched by a toggle, not shown
 * side by side — mirrors the design reference's `RCRiskList` (`rc.jsx`) and this codebase's own
 * `../../vendor-management/sections/VendorContractsScreen.tsx` list/calendar/timeline toggle.
 * Opens the shared entity drawer on row/tag click through the workspace-wide `drawer` search
 * parameter.
 *
 * "Next review" sorts by `treatment_target_date` and "reference" by `_publicId` — the closest
 * existing fields to the design's intent, since the shipped schema has neither a dedicated
 * "next review date" nor a "reference" field (see #3280's planning notes).
 */
export const RiskComplianceRisksScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const search = useSearch({ strict: false }) as RisksSearchParams;
  const q = search.q ?? '';
  const axis = search.axis ?? 'inherent';
  const view = search.view ?? 'register';
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const riskConfig = resolveRiskComplianceConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const riskSchema = schemas.data?.find(schema => schema.id === riskConfig?.riskSchemaId);

  // `risk-control` isn't a capability binding (it's a fixed relation on Risk's own
  // `mitigating_controls` field) — read its real, per-workspace relation schema id off that
  // field, mirroring `RiskDrawer.tsx`'s `riskControlRelationSchemaId`.
  const mitigatingControlsField = riskSchema?.fields.find(
    field => field.id === 'mitigating_controls'
  );
  const riskControlRelationSchemaId =
    mitigatingControlsField?.type === 'typedRelation'
      ? mitigatingControlsField.relationSchemaId
      : null;

  const risks = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: riskConfig?.riskSchemaId, view: 'full', limit: 500 },
      riskConfig != null
    )
  );
  const allItems = risks.data?.items ?? [];
  const coverage = useRiskCoverageRollups(workspaceSlug, riskControlRelationSchemaId);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allItems.filter(entity => {
      if (needle && !`${entity._name} ${entity._publicId}`.toLowerCase().includes(needle)) {
        return false;
      }
      if (search.category && entity.category !== search.category) return false;
      if (search.status && entity.status !== search.status) return false;
      if (search.owner && entity.risk_owner !== search.owner) return false;
      if (search.outsideAppetite) {
        const band = residualRiskBand(
          typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null
        );
        if (band !== 'high' && band !== 'critical') return false;
      }
      return true;
    });
  }, [allItems, q, search.category, search.status, search.owner, search.outsideAppetite]);

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    residual: (a, b) =>
      -compareNullable(
        typeof a.residual_risk_score === 'number' ? a.residual_risk_score : null,
        typeof b.residual_risk_score === 'number' ? b.residual_risk_score : null
      ),
    inherent: (a, b) =>
      -compareNullable(
        typeof a.inherent_risk_score === 'number' ? a.inherent_risk_score : null,
        typeof b.inherent_risk_score === 'number' ? b.inherent_risk_score : null
      ),
    coverage: (a, b) =>
      -compareNullable(
        coverage.byId.get(a._uid)?.rcCoverage ?? null,
        coverage.byId.get(b._uid)?.rcCoverage ?? null
      ),
    nextReview: (a, b) =>
      compareNullable(
        typeof a.treatment_target_date === 'string' ? a.treatment_target_date : null,
        typeof b.treatment_target_date === 'string' ? b.treatment_target_date : null
      ),
    reference: (a, b) => a._publicId.localeCompare(b._publicId)
  };
  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, SortKey>(filtered, comparators, {
    key: 'residual',
    dir: 'asc'
  });

  const matrixRisks: RiskComplianceMatrixRisk[] = useMemo(
    () =>
      filtered.map(entity => ({
        id: entity._publicId,
        name: entity._name,
        likelihood: typeof entity.likelihood === 'number' ? entity.likelihood : null,
        impact: typeof entity.impact === 'number' ? entity.impact : null,
        residualRiskScore:
          typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null
      })),
    [filtered]
  );

  const openRisk = (id: string) => openEntityDrawer(id);
  const patchSearch = (patch: Partial<RisksSearchParams>) =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_RISKS_ID],
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

  return (
    <div className={styles.screen}>
      <Title title="Risks" chips={!risks.isLoading && <span>{filtered.length}</span>} />

      <div className={filterStyles.toolbar}>
        <ToggleButtonGroup.Root
          type="single"
          aria-label="Risks view"
          value={view}
          onChange={value => {
            if (value)
              patchSearch({ view: value === 'register' ? undefined : (value as 'matrix') });
          }}
        >
          <ToggleButtonGroup.Item value="register">Register</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="matrix">Matrix</ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search risks by name…"
          aria-label="Search risks"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
        {view === 'register' && (
          <div style={{ marginLeft: 'auto' }}>
            <FilterDropdown
              label="Sort"
              value={sort?.key ?? 'residual'}
              onChange={value => value !== sort?.key && toggleSort(value as SortKey)}
              options={[
                { value: 'residual', label: 'Residual risk' },
                { value: 'inherent', label: 'Inherent risk' },
                { value: 'coverage', label: 'Coverage' },
                { value: 'nextReview', label: 'Next review' },
                { value: 'reference', label: 'Reference' }
              ]}
            />
          </div>
        )}
      </div>

      {view === 'matrix' ? (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              {axis === 'inherent' ? 'Inherent' : 'Residual'} risk — likelihood × impact
            </span>
            <ToggleButtonGroup.Root
              type="single"
              aria-label="Matrix axis"
              value={axis}
              onChange={value => {
                if (value)
                  patchSearch({ axis: value === 'inherent' ? undefined : (value as 'residual') });
              }}
            >
              <ToggleButtonGroup.Item value="inherent">Inherent</ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value="residual">Residual</ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          </div>
          <RiskComplianceMatrix risks={matrixRisks} axis={axis} onOpenRisk={openRisk} />
        </div>
      ) : (
        <Table.Root scroll stickyHeader>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Category</Table.HeaderCell>
              <Table.HeaderCell>Owner</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.SortableHeaderCell sortKey="inherent" sort={sort} onSort={toggleSort}>
                Inherent
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="residual" sort={sort} onSort={toggleSort}>
                Residual
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="coverage" sort={sort} onSort={toggleSort}>
                Coverage
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="nextReview" sort={sort} onSort={toggleSort}>
                Next review
              </Table.SortableHeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sorted.length === 0 ? (
              <Table.EmptyRow colSpan={8}>
                {risks.isLoading ? 'Loading risks…' : 'No risks match these filters.'}
              </Table.EmptyRow>
            ) : (
              sorted.map(entity => {
                const residualBand = residualRiskBand(
                  typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null
                );
                const entityCoverage = coverage.byId.get(entity._uid);
                return (
                  <Table.Row key={entity._uid} onClick={() => openRisk(entity._publicId)}>
                    <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                    <Table.Cell>{riskFieldValue(riskSchema, entity, 'category')}</Table.Cell>
                    <Table.Cell>{riskFieldValue(riskSchema, entity, 'risk_owner')}</Table.Cell>
                    <Table.Cell>{riskFieldValue(riskSchema, entity, 'status')}</Table.Cell>
                    <Table.Cell numeric>
                      {typeof entity.inherent_risk_score === 'number'
                        ? entity.inherent_risk_score
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {residualBand ? (
                        <Chip dot={RESIDUAL_RISK_BAND_COLOR[residualBand]} tone="ghost">
                          {residualBand}
                        </Chip>
                      ) : (
                        <span className="dim">—</span>
                      )}
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
                    <Table.Cell>
                      {typeof entity.treatment_target_date === 'string'
                        ? formatDate(entity.treatment_target_date)
                        : '—'}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      )}
    </div>
  );
};
