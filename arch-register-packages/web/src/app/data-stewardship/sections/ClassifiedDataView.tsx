import { useMemo } from 'react';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { SearchInput } from '../../../components/SearchInput';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useEntities } from '../../../hooks/useEntities';
import { usePrincipalLabel, type PrincipalValue } from '../../../hooks/usePrincipalLabel';
import type { DataStewardshipConfig } from '../dataStewardshipQueries';
import { isPersonalData, isRestrictedClassification } from '../dataFlowClassification';
import { datasetFieldValue } from '../datasetFieldDisplay';
import type { DataStewardshipClassificationSearchParams } from '../../../routes/searchParams';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './DataStewardshipStewardshipScreen.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';

type SortKey = 'classification' | 'name';

const classificationRank: Record<string, number> = {
  'highly-sensitive': 0,
  sensitive: 1,
  'non-sensitive': 2,
  public: 3,
  none: 4
};

const rankOf = (value: unknown): number =>
  typeof value === 'string' ? (classificationRank[value] ?? 5) : 5;

/**
 * The "classified data" view: every dataset, classification-first, with a derived Personal data
 * flag and a lawful-basis *proxy* column — Data Entity has no dedicated `personal_data` or
 * `lawful_basis` field (see `../dataFlowClassification.ts`), so this substitutes
 * `classification` ∈ {sensitive, highly-sensitive} for the former and `regulatory_tags` +
 * `processing_purposes` for the latter.
 */
export const ClassifiedDataView = ({
  workspaceSlug,
  dataStewardshipConfig,
  dataEntitySchema,
  search,
  patchSearch,
  openDataset
}: {
  workspaceSlug: string;
  dataStewardshipConfig: DataStewardshipConfig;
  dataEntitySchema: EntitySchema | undefined;
  search: DataStewardshipClassificationSearchParams;
  patchSearch: (patch: Partial<DataStewardshipClassificationSearchParams>) => void;
  openDataset: (id: string) => void;
}) => {
  const q = search.q ?? '';
  const datasets = useEntities(
    workspaceSlug,
    { schemaId: dataStewardshipConfig.dataEntitySchemaId, view: 'full', limit: 500 },
    { enabled: true }
  );
  const allDatasets = datasets.data;
  const principalLabel = usePrincipalLabel();

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
      if (search.personalDataOnly && !isPersonalData(entity.classification)) return false;
      return true;
    });
  }, [allDatasets, q, search.classification, search.personalDataOnly, principalLabel]);

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    classification: (a, b) => rankOf(a.classification) - rankOf(b.classification),
    name: (a, b) => a._name.localeCompare(b._name)
  };
  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, SortKey>(filtered, comparators, {
    key: (search.sort as SortKey) ?? 'classification',
    dir: 'asc'
  });

  const restrictedCount = allDatasets.filter(entity =>
    isRestrictedClassification(entity.classification)
  ).length;
  const missingLawfulBasisProxy = allDatasets.filter(entity => {
    const tags = entity.regulatory_tags;
    const purposes = entity.processing_purposes;
    const hasTags = Array.isArray(tags) ? tags.length > 0 : !!tags;
    const hasPurposes = Array.isArray(purposes) ? purposes.length > 0 : !!purposes;
    return !hasTags && !hasPurposes;
  }).length;

  return (
    <>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Restricted datasets</div>
          <div className={styles.tileValue} style={restrictedCount ? { color: DANGER } : undefined}>
            {restrictedCount}
          </div>
          <div className={styles.tileSub}>sensitive or highly sensitive</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Missing lawful-basis proxy</div>
          <div className={styles.tileValue}>{missingLawfulBasisProxy}</div>
          <div className={styles.tileSub}>no regulatory tags or processing purposes</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Total datasets</div>
          <div className={styles.tileValue}>{allDatasets.length}</div>
          <div className={styles.tileSub}>under governance</div>
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
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Dataset</Table.HeaderCell>
            <Table.SortableHeaderCell sortKey="classification" sort={sort} onSort={toggleSort}>
              Classification
            </Table.SortableHeaderCell>
            <Table.HeaderCell>Personal data</Table.HeaderCell>
            <Table.HeaderCell title="No dedicated lawful-basis field exists yet — showing regulatory tags and processing purposes as a proxy.">
              Lawful basis (proxy)
            </Table.HeaderCell>
            <Table.HeaderCell>Steward / Owner</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={5}>
              {datasets.isLoading ? 'Loading datasets…' : 'No datasets match these filters.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(entity => {
              const restricted = isRestrictedClassification(entity.classification);
              return (
                <Table.Row key={entity._uid} onClick={() => openDataset(entity._publicId)}>
                  <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                  <Table.Cell>
                    {typeof entity.classification === 'string' && entity.classification ? (
                      <Chip tone="ghost" color={restricted ? DANGER : undefined}>
                        {datasetFieldValue(dataEntitySchema, entity, 'classification')}
                      </Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>{isPersonalData(entity.classification) ? 'Yes' : 'No'}</Table.Cell>
                  <Table.Cell>
                    {[
                      datasetFieldValue(dataEntitySchema, entity, 'regulatory_tags'),
                      datasetFieldValue(dataEntitySchema, entity, 'processing_purposes')
                    ]
                      .filter(value => value !== '—')
                      .join(' · ') || <span className="dim">—</span>}
                  </Table.Cell>
                  <Table.Cell>
                    {principalLabel(entity.steward as PrincipalValue) ?? entity._owner?.name ?? (
                      <span className="dim">unassigned</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              );
            })
          )}
        </Table.Body>
      </Table.Root>
    </>
  );
};
