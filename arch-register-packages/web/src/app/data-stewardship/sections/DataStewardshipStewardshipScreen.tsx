import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useEntities } from '../../../hooks/useEntities';
import { usePrincipalLabel, type PrincipalValue } from '../../../hooks/usePrincipalLabel';
import { useSchemas } from '../../../hooks/useSchemas';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { formatDate } from '../../../utils/dateFormat';
import { resolveDataStewardshipConfig } from '../dataStewardshipQueries';
import { DS_RAIL_PATHS, DS_STEWARDSHIP_ID } from '../dataStewardshipSections';
import { computeDatasetCoverage, DATASET_COVERAGE_GAP_LABEL } from '../datasetCoverage';
import { datasetFieldValue } from '../datasetFieldDisplay';
import { DatasetDrawer } from './DatasetDrawer';
import type { DataStewardshipStewardshipSearchParams } from '../../../routes/searchParams';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './DataStewardshipStewardshipScreen.module.css';

type SortKey = 'gaps' | 'review' | 'name';

/** Stat-tile/gap-count tones, matching the design reference's `ds.jsx` `DSStewardship`: an actual
 *  gap (no owner/steward, or a per-dataset gap count) reads as danger/red, while a soft threshold
 *  (low overall coverage %, an overdue-but-not-missing review) reads as warn/amber. */
const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

const compareNullable = (a: string | null, b: string | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

const GAPS_TO_CLOSE_LIMIT = 8;

/**
 * The Stewardship section: coverage across every dataset (Information Asset / Data Entity) under
 * governance — a stat strip, a "gaps to close" panel, and the full searchable/sortable dataset
 * table. Mirrors the Claude Design reference's `DSStewardship` (`ds.jsx`) and this codebase's own
 * `../../risk-compliance/sections/RiskComplianceRisksScreen.tsx` for the search/sort/table
 * structure, opening the shared `DatasetDrawer` (#3296) on row click — its first real consumer.
 *
 * Two of the design reference's pieces don't survive the shipped schema and are dropped rather
 * than faked: a per-dataset "domain" (there is no generic per-instance domain/category field on
 * Data Entity, so "coverage by domain" has nothing to bucket by — `computeDatasetCoverageSummary`
 * already collapses to one "All datasets" bucket for the same reason) and a "quality" score/sort
 * (no quality field or assessment has shipped anywhere yet). Both are documented gaps in
 * `../datasetCoverage.ts`, not silently defaulted. The stat strip substitutes "Missing steward"
 * for the design's "Certified" (no such field either), since owner and steward gaps are the two
 * most actionable numbers `computeDatasetCoverage` reports.
 */
export const DataStewardshipStewardshipScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipStewardshipSearchParams;
  const q = search.q ?? '';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const dataStewardshipConfig = resolveDataStewardshipConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const dataEntitySchema = schemas.data?.find(
    schema => schema.id === dataStewardshipConfig?.dataEntitySchemaId
  );

  const datasets = useEntities(
    workspaceSlug,
    { schemaId: dataStewardshipConfig?.dataEntitySchemaId, view: 'full', limit: 500 },
    { enabled: dataStewardshipConfig != null }
  );
  const allDatasets = datasets.data;
  const principalLabel = usePrincipalLabel();

  const coverageById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeDatasetCoverage>>();
    for (const entity of allDatasets) {
      map.set(
        entity._uid,
        computeDatasetCoverage({
          owner: entity._owner,
          steward: entity.steward,
          classification: entity.classification,
          reviewStatus: entity.review_status
        })
      );
    }
    return map;
  }, [allDatasets]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allDatasets.filter(entity => {
      const ownerName = typeof entity._owner?.name === 'string' ? entity._owner.name : '';
      const stewardName = principalLabel(entity.steward as PrincipalValue) ?? '';
      if (
        needle &&
        !`${entity._name} ${entity._publicId} ${ownerName} ${stewardName}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      if (search.classification && entity.classification !== search.classification) return false;
      if (search.gapsOnly && coverageById.get(entity._uid)?.dsCovered) return false;
      return true;
    });
  }, [allDatasets, q, search.classification, search.gapsOnly, coverageById, principalLabel]);

  // Shares `filtered`'s classification/search/gapsOnly narrowing (the sidebar's Classification
  // facet and the toolbar's search box both apply to this panel too), on top of its own actual
  // coverage-gap filter.
  const gapsToClose = useMemo(
    () => filtered.filter(entity => !coverageById.get(entity._uid)?.dsCovered),
    [filtered, coverageById]
  );

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    gaps: (a, b) =>
      -((coverageById.get(a._uid)?.dsGaps.length ?? 0) -
        (coverageById.get(b._uid)?.dsGaps.length ?? 0)),
    review: (a, b) =>
      compareNullable(
        typeof a.review_date === 'string' ? a.review_date : null,
        typeof b.review_date === 'string' ? b.review_date : null
      ),
    name: (a, b) => a._name.localeCompare(b._name)
  };
  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, SortKey>(filtered, comparators, {
    key: search.sort ?? 'gaps',
    dir: 'asc'
  });

  const covered = allDatasets.filter(entity => coverageById.get(entity._uid)?.dsCovered);
  const missingOwner = allDatasets.filter(entity => entity._owner == null);
  const missingSteward = allDatasets.filter(entity => entity.steward == null);
  const reviewsOverdue = allDatasets.filter(entity => entity.review_status === 'overdue');
  const coveragePct =
    allDatasets.length > 0 ? Math.round((100 * covered.length) / allDatasets.length) : null;

  const openDataset = (id: string) =>
    navigate({
      to: DS_RAIL_PATHS[DS_STEWARDSHIP_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, datasetId: id })
    });
  const closeDataset = () =>
    navigate({
      to: DS_RAIL_PATHS[DS_STEWARDSHIP_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, datasetId: undefined })
    });
  const patchSearch = (patch: Partial<DataStewardshipStewardshipSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_STEWARDSHIP_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading data stewardship…</div>;
  }
  if (!dataStewardshipConfig) {
    return (
      <div className={styles.empty}>
        Data stewardship is not enabled. Configure the data stewardship capability in workspace
        settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title
        title="Stewardship"
        chips={!datasets.isLoading && <span>{filtered.length}</span>}
        description={`Coverage across ${allDatasets.length} dataset${allDatasets.length === 1 ? '' : 's'}: who owns each one, who stewards it day to day, when it was last reviewed and what is missing.`}
      />

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Fully covered</div>
          <div
            className={styles.tileValue}
            style={coveragePct != null && coveragePct < 60 ? { color: WARN } : undefined}
          >
            {coveragePct != null ? `${coveragePct}%` : '—'}
          </div>
          <div className={styles.tileSub}>
            {covered.length} of {allDatasets.length} datasets clean
          </div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Missing an owner</div>
          <div className={styles.tileValue} style={missingOwner.length ? { color: DANGER } : undefined}>
            {missingOwner.length}
          </div>
          <div className={styles.tileSub}>{missingSteward.length} missing a steward</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Reviews overdue</div>
          <div
            className={styles.tileValue}
            style={reviewsOverdue.length ? { color: WARN } : undefined}
          >
            {reviewsOverdue.length}
          </div>
          <div className={styles.tileSub}>scheduled date passed</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Missing a steward</div>
          <div
            className={styles.tileValue}
            style={missingSteward.length ? { color: DANGER } : undefined}
          >
            {missingSteward.length}
          </div>
          <div className={styles.tileSub}>{missingOwner.length} missing an owner</div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Gaps to close</span>
          <span className="dim mono">{gapsToClose.length}</span>
        </div>
        <div className={styles.stack}>
          {gapsToClose.length === 0 ? (
            <div className={`${styles.empty} dim`}>
              {datasets.isLoading ? 'Loading datasets…' : 'No coverage gaps.'}
            </div>
          ) : (
            gapsToClose.slice(0, GAPS_TO_CLOSE_LIMIT).map(entity => {
              const gaps = coverageById.get(entity._uid)?.dsGaps ?? [];
              return (
                <button
                  key={entity._uid}
                  type="button"
                  className={styles.row}
                  onClick={() => openDataset(entity._publicId)}
                >
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{entity._name}</span>
                    <span className={styles.tags}>
                      {gaps.map(gap => (
                        <span key={gap} className={styles.gapTag}>
                          {DATASET_COVERAGE_GAP_LABEL[gap]}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className={filterStyles.toolbar}>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search datasets, owners, stewards…"
          aria-label="Search datasets"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
        <div style={{ marginLeft: 'auto' }}>
          <FilterDropdown
            label="Sort"
            value={sort?.key ?? 'gaps'}
            onChange={value => value !== sort?.key && toggleSort(value as SortKey)}
            options={[
              { value: 'gaps', label: 'Gaps' },
              { value: 'review', label: 'Next review' },
              { value: 'name', label: 'Name' }
            ]}
          />
        </div>
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Dataset</Table.HeaderCell>
            <Table.HeaderCell>Business owner</Table.HeaderCell>
            <Table.HeaderCell>Steward</Table.HeaderCell>
            <Table.HeaderCell>Classification</Table.HeaderCell>
            <Table.SortableHeaderCell sortKey="review" sort={sort} onSort={toggleSort}>
              Next review
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="gaps" sort={sort} onSort={toggleSort}>
              Gaps
            </Table.SortableHeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={6}>
              {datasets.isLoading ? 'Loading datasets…' : 'No datasets match these filters.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(entity => {
              const coverage = coverageById.get(entity._uid);
              const gapCount = coverage?.dsGaps.length ?? 0;
              const classification =
                typeof entity.classification === 'string' ? entity.classification : null;
              return (
                <Table.Row key={entity._uid} onClick={() => openDataset(entity._publicId)}>
                  <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                  <Table.Cell className={entity._owner == null ? 'dim' : undefined}>
                    {entity._owner?.name ?? 'unassigned'}
                  </Table.Cell>
                  <Table.Cell className={entity.steward == null ? 'dim' : undefined}>
                    {principalLabel(entity.steward as PrincipalValue) ?? 'unassigned'}
                  </Table.Cell>
                  <Table.Cell>
                    {classification ? (
                      <Chip tone="ghost">{datasetFieldValue(dataEntitySchema, entity, 'classification')}</Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>{formatDate(entity.review_date)}</Table.Cell>
                  <Table.Cell numeric>
                    <span style={{ color: gapCount ? DANGER : undefined }}>
                      {gapCount || '—'}
                    </span>
                  </Table.Cell>
                </Table.Row>
              );
            })
          )}
        </Table.Body>
      </Table.Root>

      {search.datasetId && (
        <DatasetDrawer
          workspaceSlug={workspaceSlug}
          datasetId={search.datasetId}
          dataStewardshipConfig={dataStewardshipConfig}
          onClose={closeDataset}
        />
      )}
    </div>
  );
};
