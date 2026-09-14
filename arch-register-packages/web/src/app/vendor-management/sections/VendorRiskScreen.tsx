import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatDate } from '../../../utils/dateFormat';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { VENDOR_RAIL_PATHS, VENDOR_RISK_ID } from '../vendorManagementSections';
import {
  computeVendorRisk,
  VENDOR_RISK_BAND_COLOR,
  type VendorRiskBand,
  type VendorRiskResult
} from '../vendorRisk';
import { vendorFieldValue } from '../vendorFieldDisplay';
import { useVendorTechnologyExposure } from '../useVendorTechnologyExposure';
import {
  TECHNOLOGY_EOL_EXPOSURE_BAND_COLOR,
  TECHNOLOGY_EOL_EXPOSURE_BAND_LABEL
} from '../technologyEolExposure';
import type { RiskSearchParams } from '../../../routes/searchParams';
import { RiskMatrix, type RiskMatrixCell } from './RiskMatrix';
import { VendorDrawer } from './VendorDrawer';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import placeholderStyles from './VendorManagementPlaceholderScreen.module.css';
import styles from './VendorRiskScreen.module.css';

type SortKey = 'name' | 'criticality' | 'risk';

/** Descending by value, nulls sorted last regardless of direction — used directly (not negated)
 *  so the default sort (`risk`, applied with no `useTableSort` reversal) reads highest-risk-first
 *  without an unscored vendor's null jumping ahead of scored ones. */
const compareNullableDescending = (a: number | null, b: number | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
};

/**
 * The Risk section: a criticality × risk-band matrix, a sortable/filterable vendor risk register
 * table, and a technology end-of-life (EOL) exposure table cross-referencing linked Systems'
 * Technology Releases — the three views scoped by #3263. Reuses the same composite `vmRisk`/
 * `vmRiskBand` model (`vendorRisk.ts`) already shown in the Vendors table and vendor drawer.
 *
 * The matrix and table share the same `band`/`criticality` filters (`RiskSearchParams`), so
 * clicking a matrix cell narrows the table below it, and the sidebar's `RiskSidebarContent`
 * facets do the same. Selecting a vendor row opens the shared `VendorDrawer`, deep-linkable at
 * `vendor-management/risk/$vendorId`.
 *
 * The EOL exposure table depends on the `vendor-management` capability's optional
 * `technologyRelease` schema binding (see `useVendorTechnologyExposure.ts`) — when unbound, or
 * when no schema links a System to it, it shows an explanatory empty state instead of data,
 * mirroring `VendorSpendScreen.tsx`'s capability-grouping caveat.
 */
export const VendorRiskScreen = () => {
  const { workspaceSlug, vendorId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    vendorId?: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as RiskSearchParams;
  const q = search.q ?? '';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const vendorSchema = schemas.data?.find(schema => schema.id === vendorConfig?.vendorSchemaId);
  const contractSchema = schemas.data?.find(schema => schema.id === vendorConfig?.contractSchemaId);
  // `system-contract` isn't exposed by `resolveVendorManagementConfig` — read its real,
  // per-workspace relation schema id off Contract's `system` typedRelation field, same as
  // `VendorDrawer.tsx` does.
  const systemField = contractSchema?.fields.find(field => field.id === 'system');
  const systemContractRelationSchemaId =
    systemField?.type === 'typedRelation' ? systemField.relationSchemaId : null;

  const vendors = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: vendorConfig?.vendorSchemaId, view: 'full', limit: 500 },
      vendorConfig != null
    )
  );
  const allVendors = vendors.data?.items ?? [];

  const riskByUid = useMemo(() => {
    const map = new Map<string, VendorRiskResult>();
    for (const entity of allVendors) {
      map.set(
        entity._uid,
        computeVendorRisk({
          security_risk: typeof entity.security_risk === 'number' ? entity.security_risk : null,
          concentration_risk:
            typeof entity.concentration_risk === 'number' ? entity.concentration_risk : null,
          financial_risk: typeof entity.financial_risk === 'number' ? entity.financial_risk : null,
          compliance_risk:
            typeof entity.compliance_risk === 'number' ? entity.compliance_risk : null,
          criticality: typeof entity.criticality === 'number' ? entity.criticality : null
        })
      );
    }
    return map;
  }, [allVendors]);

  const matrixCells = useMemo<RiskMatrixCell[]>(() => {
    const counts = new Map<string, number>();
    for (const entity of allVendors) {
      const risk = riskByUid.get(entity._uid);
      const criticality = typeof entity.criticality === 'number' ? entity.criticality : null;
      if (criticality == null || !risk?.vmRiskBand) continue;
      const key = `${criticality}:${risk.vmRiskBand}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => {
      const [criticality, band] = key.split(':');
      return { criticality: Number(criticality), band: band as VendorRiskBand, count };
    });
  }, [allVendors, riskByUid]);

  const criticalityFilter = search.criticality ? Number(search.criticality) : null;
  const bandFilter = (search.band as VendorRiskBand | undefined) ?? null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allVendors.filter(entity => {
      if (needle && !`${entity._name} ${entity._publicId}`.toLowerCase().includes(needle)) {
        return false;
      }
      if (criticalityFilter != null && entity.criticality !== criticalityFilter) return false;
      if (bandFilter && riskByUid.get(entity._uid)?.vmRiskBand !== bandFilter) return false;
      return true;
    });
  }, [allVendors, q, criticalityFilter, bandFilter, riskByUid]);

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    name: (a, b) => a._name.localeCompare(b._name),
    criticality: (a, b) =>
      compareNullableDescending(
        typeof a.criticality === 'number' ? a.criticality : null,
        typeof b.criticality === 'number' ? b.criticality : null
      ),
    risk: (a, b) =>
      compareNullableDescending(
        riskByUid.get(a._uid)?.vmRisk ?? null,
        riskByUid.get(b._uid)?.vmRisk ?? null
      )
  };
  // Both comparators already sort highest-first with nulls last, so the default (`risk`, `dir:
  // 'asc'`) reads correctly with no `useTableSort` reversal.
  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, SortKey>(filtered, comparators, {
    key: 'risk',
    dir: 'asc'
  });

  const vendorIds = useMemo(() => allVendors.map(entity => entity._uid), [allVendors]);
  const exposure = useVendorTechnologyExposure(
    workspaceSlug,
    vendorConfig?.vendorSchemaId ?? null,
    vendorIds,
    vendorConfig?.contractSchemaId ?? null,
    systemContractRelationSchemaId,
    vendorConfig?.technologyReleaseSchemaId ?? null,
    schemas.data ?? []
  );
  const exposureRows = useMemo(
    () =>
      [...exposure.items].sort(
        (a, b) => (a.exposure.daysUntilEol ?? Infinity) - (b.exposure.daysUntilEol ?? Infinity)
      ),
    [exposure.items]
  );

  const openVendor = (id: string) =>
    navigate({
      to: `${VENDOR_RAIL_PATHS[VENDOR_RISK_ID]}/$vendorId`,
      params: { workspaceSlug, vendorId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeVendor = () =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_RISK_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });
  const patchSearch = (patch: Partial<RiskSearchParams>) =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_RISK_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  if (configurations.isLoading) {
    return <div className={placeholderStyles.empty}>Loading vendor management…</div>;
  }
  if (!vendorConfig) {
    return (
      <div className={placeholderStyles.empty}>
        Vendor management is not enabled. Configure the vendor management capability in workspace
        settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title
        title="Risk"
        description="A criticality × risk-band view of the vendor register, plus technology end-of-life
          exposure across the Systems your vendors' contracts serve."
      />

      <div>
        <div className={styles.sectionLabel}>Criticality × risk band</div>
        <RiskMatrix
          cells={matrixCells}
          activeCriticality={criticalityFilter ?? undefined}
          activeBand={bandFilter ?? undefined}
          onCellClick={(criticality, band) =>
            patchSearch({
              criticality:
                criticalityFilter === criticality && bandFilter === band
                  ? undefined
                  : String(criticality),
              band: criticalityFilter === criticality && bandFilter === band ? undefined : band
            })
          }
        />
      </div>

      <div>
        <div className={styles.sectionLabel}>Risk register</div>
        <div className={filterStyles.toolbar}>
          <SearchInput
            size="sm"
            className={filterStyles.searchInline}
            value={q}
            placeholder="Search vendors by name…"
            aria-label="Search vendors"
            onChange={value => patchSearch({ q: value || undefined })}
            onClear={() => patchSearch({ q: undefined })}
          />
          {(criticalityFilter != null || bandFilter) && (
            <Button
              variant="ghost"
              onClick={() => patchSearch({ criticality: undefined, band: undefined })}
            >
              Clear filter
            </Button>
          )}
        </div>

        <Table.Root scroll stickyHeader>
          <Table.Head>
            <Table.Row>
              <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
                Name
              </Table.SortableHeaderCell>
              <Table.HeaderCell>Tier</Table.HeaderCell>
              <Table.SortableHeaderCell
                sortKey="criticality"
                sort={sort}
                onSort={toggleSort}
                numeric
              >
                Criticality
              </Table.SortableHeaderCell>
              <Table.HeaderCell numeric>Security</Table.HeaderCell>
              <Table.HeaderCell numeric>Concentration</Table.HeaderCell>
              <Table.HeaderCell numeric>Financial</Table.HeaderCell>
              <Table.HeaderCell numeric>Compliance</Table.HeaderCell>
              <Table.SortableHeaderCell sortKey="risk" sort={sort} onSort={toggleSort}>
                vmRisk
              </Table.SortableHeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sorted.length === 0 ? (
              <Table.EmptyRow colSpan={8}>
                {vendors.isLoading ? 'Loading vendors…' : 'No vendors match these filters.'}
              </Table.EmptyRow>
            ) : (
              sorted.map(entity => {
                const risk = riskByUid.get(entity._uid);
                return (
                  <Table.Row key={entity._uid} onClick={() => openVendor(entity._publicId)}>
                    <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                    <Table.Cell>{vendorFieldValue(vendorSchema, entity, 'tier')}</Table.Cell>
                    <Table.Cell numeric>
                      {typeof entity.criticality === 'number' ? entity.criticality : '—'}
                    </Table.Cell>
                    <Table.Cell numeric>
                      {typeof entity.security_risk === 'number' ? entity.security_risk : '—'}
                    </Table.Cell>
                    <Table.Cell numeric>
                      {typeof entity.concentration_risk === 'number'
                        ? entity.concentration_risk
                        : '—'}
                    </Table.Cell>
                    <Table.Cell numeric>
                      {typeof entity.financial_risk === 'number' ? entity.financial_risk : '—'}
                    </Table.Cell>
                    <Table.Cell numeric>
                      {typeof entity.compliance_risk === 'number' ? entity.compliance_risk : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {risk?.vmRisk != null ? (
                        <Chip dot={VENDOR_RISK_BAND_COLOR[risk.vmRiskBand!]} tone="ghost">
                          {Math.round(risk.vmRisk)} · {risk.vmRiskBand}
                        </Chip>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      </div>

      <div>
        <div className={styles.sectionLabel}>
          Technology end-of-life exposure
          <span className={styles.sectionCaption}>
            Systems used by vendor contracts, cross-referenced against linked Technology Releases.
          </span>
        </div>
        {!vendorConfig.technologyReleaseSchemaId ? (
          <div className={styles.eolEmpty}>
            Bind a Technology Release entity schema to the vendor-management capability's
            "Technology Release entity schema" role in Applications & Capabilities workspace
            settings to see EOL exposure here.
          </div>
        ) : exposure.unavailable ? (
          <div className={styles.eolEmpty}>
            No entity schema links a System to the bound Technology Release schema (typically a
            Component or Resource schema, via a reference field). Check the linking schema's field
            configuration.
          </div>
        ) : (
          <Table.Root scroll stickyHeader>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>System</Table.HeaderCell>
                <Table.HeaderCell>Technology</Table.HeaderCell>
                <Table.HeaderCell>EOL date</Table.HeaderCell>
                <Table.HeaderCell>Exposure</Table.HeaderCell>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell>Contract</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {exposureRows.length === 0 ? (
                <Table.EmptyRow colSpan={6}>
                  {exposure.isLoading
                    ? 'Loading technology exposure…'
                    : 'No linked Technology Releases found.'}
                </Table.EmptyRow>
              ) : (
                exposureRows.map(row => (
                  <Table.Row
                    key={`${row.system._uid}-${row.technologyRelease._uid}`}
                    onClick={() => openVendor(row.vendor._publicId)}
                  >
                    <Table.NameCell title={row.system._name} />
                    <Table.Cell>{row.technologyRelease._name}</Table.Cell>
                    <Table.Cell>
                      {row.exposure.effectiveDate ? formatDate(row.exposure.effectiveDate) : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      {row.exposure.band ? (
                        <Chip
                          dot={TECHNOLOGY_EOL_EXPOSURE_BAND_COLOR[row.exposure.band]}
                          tone="ghost"
                        >
                          {TECHNOLOGY_EOL_EXPOSURE_BAND_LABEL[row.exposure.band]}
                        </Chip>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{row.vendor._name}</Table.Cell>
                    <Table.Cell>{row.contract._name}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        )}
      </div>

      {vendorId && (
        <VendorDrawer
          workspaceSlug={workspaceSlug}
          vendorId={vendorId}
          vendorConfig={vendorConfig}
          onClose={closeVendor}
        />
      )}
    </div>
  );
};
