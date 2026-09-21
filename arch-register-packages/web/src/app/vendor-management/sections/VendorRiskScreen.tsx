import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../../components/Title';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatDate } from '../../../utils/dateFormat';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { VENDOR_RAIL_PATHS, VENDOR_RISK_ID } from '../vendorManagementSections';
import { computeVendorRisk, VENDOR_RISK_BAND_COLOR, type VendorRiskBand } from '../vendorRisk';
import {
  useVendorTechnologyExposure,
  groupVendorTechnologyExposure
} from '../useVendorTechnologyExposure';
import type { RiskSearchParams } from '../../../routes/searchParams';
import { RiskMatrix, type RiskMatrixVendor } from './RiskMatrix';
import { VendorDrawer } from './VendorDrawer';
import tileStyles from './VendorSpendScreen.module.css';
import placeholderStyles from './VendorManagementPlaceholderScreen.module.css';
import styles from './VendorRiskScreen.module.css';

const CONCENTRATION_ALERT_THRESHOLD = 4;

/**
 * The Risk section: a criticality × risk-band matrix, a vendor risk register, and a technology
 * end-of-life (EOL) exposure view cross-referencing linked Systems' Technology Releases — the
 * three views scoped by #3263. Layout, stats, and both tables mirror the Claude Design
 * reference's `vendor-views.jsx` (`VMRisk`) closely: four header stats, a two-column
 * matrix-plus-register row, and a full-width EOL table below it. Reuses the composite `vmRisk`/
 * `vmRiskBand` model (`vendorRisk.ts`) already shown in the Vendors table and vendor drawer.
 *
 * The matrix, risk register, and EOL table are all filtered by the sidebar's Band and Technology
 * EOL facets (`RiskSearchParams.band`/`technology`, combined with AND) — selecting a facet narrows
 * every panel down to the matching vendor(s), rather than only the register (this deliberately
 * diverges from the design reference, whose matrix/sidebar aren't filter-linked). Clicking a
 * vendor tag or row still opens the `VendorDrawer` directly, deep-linkable at
 * `vendor-management/risk/$vendorId`. The four header stats stay portfolio-wide regardless of the
 * active filters, mirroring `VendorSpendScreen.tsx`'s sidebar-facets-narrow-rows-not-stats
 * convention.
 *
 * The EOL table depends on the `vendor-management` capability's optional `technologyRelease`
 * schema binding (see `useVendorTechnologyExposure.ts`) — when unbound, or when no schema links a
 * System to it, it shows an explanatory empty state instead of data, mirroring
 * `VendorSpendScreen.tsx`'s capability-grouping caveat.
 */
export const VendorRiskScreen = () => {
  const { workspaceSlug, vendorId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    vendorId?: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as RiskSearchParams;
  const bandFilter = (search.band as VendorRiskBand | undefined) ?? null;
  const technologyFilter = search.technology ?? null;

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
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
    const map = new Map<string, ReturnType<typeof computeVendorRisk>>();
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
  // Unfiltered — every vendor's technology exposure, portfolio-wide. Used for the header stats
  // (which stay portfolio-wide) and to resolve `technologyFilter` to the vendor(s) it names.
  const eolGroupsAll = useMemo(() => {
    const grouped = groupVendorTechnologyExposure(exposure.items);
    return [...grouped].sort(
      (a, b) => (a.exposure.daysUntilEol ?? Infinity) - (b.exposure.daysUntilEol ?? Infinity)
    );
  }, [exposure.items]);

  // A `technology` filter names one Technology Release uid — the same technology can be exposed
  // via more than one vendor, so this is a set, not a single id (mirrors the sidebar's
  // `eolByTechnology` de-duplication in `VendorManagementSidebar.tsx`, which lists one row per
  // Technology Release rather than one per (vendor, Technology Release) pair).
  const technologyFilterVendorIds = useMemo(() => {
    if (!technologyFilter) return null;
    return new Set(
      eolGroupsAll
        .filter(group => group.technologyRelease._uid === technologyFilter)
        .map(group => group.vendor._uid)
    );
  }, [eolGroupsAll, technologyFilter]);

  const vendorInScope = useCallback(
    (entity: EntityRecord): boolean => {
      if (bandFilter && riskByUid.get(entity._uid)?.vmRiskBand !== bandFilter) return false;
      if (technologyFilterVendorIds && !technologyFilterVendorIds.has(entity._uid)) return false;
      return true;
    },
    [bandFilter, technologyFilterVendorIds, riskByUid]
  );

  const vendorsByCell = useMemo(() => {
    const map = new Map<string, RiskMatrixVendor[]>();
    for (const entity of allVendors) {
      if (!vendorInScope(entity)) continue;
      const risk = riskByUid.get(entity._uid);
      const criticality = typeof entity.criticality === 'number' ? entity.criticality : null;
      if (criticality == null || !risk?.vmRiskBand) continue;
      const key = `${criticality}:${risk.vmRiskBand}`;
      const list = map.get(key) ?? [];
      list.push({ id: entity._publicId, name: entity._name });
      map.set(key, list);
    }
    return map;
  }, [allVendors, riskByUid, vendorInScope]);

  const registerRows = useMemo(
    () =>
      allVendors
        .filter(vendorInScope)
        .sort(
          (a, b) => (riskByUid.get(b._uid)?.vmRisk ?? 0) - (riskByUid.get(a._uid)?.vmRisk ?? 0)
        ),
    [allVendors, vendorInScope, riskByUid]
  );

  // A vendor in scope may carry exposure to technologies other than the one selected — narrow to
  // the exact technology too, not just its vendor(s).
  const eolRows = useMemo(
    () =>
      eolGroupsAll.filter(
        group =>
          vendorInScope(group.vendor) &&
          (!technologyFilter || group.technologyRelease._uid === technologyFilter)
      ),
    [eolGroupsAll, vendorInScope, technologyFilter]
  );

  const exposedSystemCount = useMemo(() => {
    const ids = new Set<string>();
    for (const row of eolGroupsAll) for (const system of row.systems) ids.add(system._uid);
    return ids.size;
  }, [eolGroupsAll]);

  const highRiskCount = allVendors.filter(
    entity => riskByUid.get(entity._uid)?.vmRiskBand === 'high'
  ).length;
  const highConcentrationCount = allVendors.filter(
    entity =>
      typeof entity.concentration_risk === 'number' &&
      entity.concentration_risk >= CONCENTRATION_ALERT_THRESHOLD
  ).length;
  const eolAtRiskCount = eolGroupsAll.filter(
    row => row.exposure.band && row.exposure.band !== 'ok'
  ).length;

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

  const isLoading = vendors.isLoading;

  return (
    <div className={styles.screen}>
      <Title
        title="Risk"
        description="Composite vendor risk against business criticality, plus the technology end-of-life
          each vendor carries into the estate."
        buttons={
          <Button
            variant="secondary"
            onClick={() =>
              navigate({
                to: '/$workspaceSlug/entities',
                params: { workspaceSlug },
                search: (previous: Record<string, unknown>) => ({
                  ...previous,
                  viewMode: 'radar' as const
                })
              })
            }
          >
            Technology radar
          </Button>
        }
      />

      <div className={tileStyles.tiles}>
        <div className={tileStyles.tile}>
          <div className={tileStyles.tileLabel}>High risk</div>
          <div className={tileStyles.tileValue} style={{ color: VENDOR_RISK_BAND_COLOR.high }}>
            {highRiskCount}
          </div>
          <div className={tileStyles.tileSub}>review required</div>
        </div>
        <div className={tileStyles.tile}>
          <div className={tileStyles.tileLabel}>
            Concentration ≥ {CONCENTRATION_ALERT_THRESHOLD}
          </div>
          <div className={tileStyles.tileValue} style={{ color: VENDOR_RISK_BAND_COLOR.elevated }}>
            {highConcentrationCount}
          </div>
          <div className={tileStyles.tileSub}>single-source dependency</div>
        </div>
        <div className={tileStyles.tile}>
          <div className={tileStyles.tileLabel}>Technologies near EOL</div>
          <div className={tileStyles.tileValue}>{eolAtRiskCount}</div>
          <div className={tileStyles.tileSub}>within 12 months, vendor-supported lifecycle</div>
        </div>
        <div className={tileStyles.tile}>
          <div className={tileStyles.tileLabel}>Systems exposed</div>
          <div className={tileStyles.tileValue} style={{ color: VENDOR_RISK_BAND_COLOR.elevated }}>
            {exposedSystemCount}
          </div>
          <div className={tileStyles.tileSub}>linked to an EOL technology</div>
        </div>
      </div>

      <div className={styles.two}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Criticality × risk</span>
            <span className="dim mono">{registerRows.length} vendors</span>
          </div>
          <RiskMatrix vendorsByCell={vendorsByCell} onOpenVendor={openVendor} />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Risk register</span>
            <span className="dim mono">{registerRows.length}</span>
          </div>
          <Table.Root scroll stickyHeader bordered={false}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell numeric>Sec</Table.HeaderCell>
                <Table.HeaderCell numeric>Conc</Table.HeaderCell>
                <Table.HeaderCell numeric>Fin</Table.HeaderCell>
                <Table.HeaderCell numeric>Comp</Table.HeaderCell>
                <Table.HeaderCell>Score</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {registerRows.length === 0 ? (
                <Table.EmptyRow colSpan={6}>
                  {isLoading ? 'Loading vendors…' : 'No vendors match this filter.'}
                </Table.EmptyRow>
              ) : (
                registerRows.map(entity => {
                  const risk = riskByUid.get(entity._uid);
                  return (
                    <Table.Row key={entity._uid} onClick={() => openVendor(entity._publicId)}>
                      <Table.NameCell title={entity._name} />
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
                            {risk.vmRiskBand} · {risk.vmRisk.toFixed(1)}
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
      </div>

      {/* Hidden entirely (not an empty state) when the feature isn't usable in this workspace —
          no Technology Release schema bound, or bound but no schema links a System to it — rather
          than showing a panel whose only content explains why it's empty. A genuinely empty
          result (bound and linked, just no exposure yet) still renders the table with its own
          empty row below. */}
      {vendorConfig.technologyReleaseSchemaId && !exposure.unavailable && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Technology end-of-life — linked applications</span>
            <span className="dim mono">{eolRows.length}</span>
          </div>
          <Table.Root scroll stickyHeader bordered={false}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Technology</Table.HeaderCell>
                <Table.HeaderCell>Radar ring</Table.HeaderCell>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell>Support ends</Table.HeaderCell>
                <Table.HeaderCell numeric>Runway</Table.HeaderCell>
                <Table.HeaderCell>Systems affected</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {eolRows.length === 0 ? (
                <Table.EmptyRow colSpan={6}>
                  {exposure.isLoading
                    ? 'Loading technology exposure…'
                    : 'No linked Technology Releases found.'}
                </Table.EmptyRow>
              ) : (
                eolRows.map(row => {
                  const runwayMonths =
                    row.exposure.daysUntilEol != null
                      ? Math.round(row.exposure.daysUntilEol / 30)
                      : null;
                  const urgent =
                    row.exposure.band === 'past' || row.exposure.band === 'within6Months';
                  return (
                    <Table.Row key={row.key} onClick={() => openVendor(row.vendor._publicId)}>
                      <Table.NameCell title={row.technologyRelease._name} />
                      <Table.Cell>
                        <span className="dim">
                          {typeof row.technologyRelease.radar_status === 'string'
                            ? row.technologyRelease.radar_status
                            : '—'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>{row.vendor._name}</Table.Cell>
                      <Table.Cell>
                        {row.exposure.effectiveDate ? formatDate(row.exposure.effectiveDate) : '—'}
                      </Table.Cell>
                      <Table.Cell
                        numeric
                        style={{
                          color: urgent
                            ? VENDOR_RISK_BAND_COLOR.high
                            : VENDOR_RISK_BAND_COLOR.elevated
                        }}
                      >
                        {runwayMonths != null ? `${runwayMonths} months` : '—'}
                      </Table.Cell>
                      <Table.Cell>
                        {row.systems.length === 0 ? (
                          <span className="dim">None linked</span>
                        ) : (
                          <span className="dim">
                            {row.systems.map(system => system._name).join(', ')}
                          </span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table.Root>
        </div>
      )}

      {vendorId && (
        <VendorDrawer workspaceSlug={workspaceSlug} vendorId={vendorId} onClose={closeVendor} />
      )}
    </div>
  );
};
