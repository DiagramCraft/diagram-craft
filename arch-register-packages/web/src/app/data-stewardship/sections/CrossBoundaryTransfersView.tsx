import { useMemo } from 'react';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useRelations } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import type { DataFlowConfig } from '../useDataFlowConfig';
import { evaluateDataFlowCoverage, relationFieldValue } from '../dataFlowClassification';
import { DataFlowNotConfiguredNotice } from './DataFlowNotConfiguredNotice';
import styles from './DataStewardshipStewardshipScreen.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

type SortKey = 'unsafeguarded' | 'name';

/**
 * The "cross-boundary transfers" view: every Data Flow relation whose derived `cross_boundary`
 * field is `'cross-boundary'`, paired with the exception that authorizes it — except that pairing
 * doesn't exist yet (#3301). Every personal-data-carrying cross-boundary transfer is flagged as
 * lacking a recorded safeguard until then; see `../dataFlowClassification.ts`'s
 * `evaluateDataFlowCoverage`, the single place that logic lives.
 */
export const CrossBoundaryTransfersView = ({
  workspaceSlug,
  dataFlowConfig
}: {
  workspaceSlug: string;
  dataFlowConfig: DataFlowConfig | null;
}) => {
  const relationSchemas = useRelationSchemas(workspaceSlug, dataFlowConfig != null);
  const relationSchema = relationSchemas.data?.find(
    candidate => candidate.id === dataFlowConfig?.relationSchemaId
  );

  const relations = useRelations(
    workspaceSlug,
    { schemaId: dataFlowConfig?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig != null }
  );

  const crossBoundary = useMemo(
    () => relations.data.filter(relation => relation.cross_boundary === 'cross-boundary'),
    [relations.data]
  );

  const coverageByUid = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateDataFlowCoverage>>();
    for (const relation of crossBoundary) {
      map.set(
        relation._uid,
        evaluateDataFlowCoverage({
          crossBoundary: relation.cross_boundary,
          classification: relation.data_classification
        })
      );
    }
    return map;
  }, [crossBoundary]);

  const comparators: Record<SortKey, (a: RelationRecord, b: RelationRecord) => number> = {
    unsafeguarded: (a, b) =>
      -(
        Number(coverageByUid.get(a._uid)?.unsafeguardedPersonalDataTransfer ?? false) -
        Number(coverageByUid.get(b._uid)?.unsafeguardedPersonalDataTransfer ?? false)
      ),
    name: (a, b) => a._in.name.localeCompare(b._in.name)
  };
  const { sorted, sort, toggleSort } = useTableSort<RelationRecord, SortKey>(
    crossBoundary,
    comparators,
    { key: 'unsafeguarded', dir: 'asc' }
  );

  if (!dataFlowConfig) {
    return <DataFlowNotConfiguredNotice title="Cross-boundary transfers" />;
  }

  const carryingPersonalData = crossBoundary.filter(
    relation => coverageByUid.get(relation._uid)?.carriesPersonalData
  ).length;
  const unsafeguarded = crossBoundary.filter(
    relation => coverageByUid.get(relation._uid)?.unsafeguardedPersonalDataTransfer
  ).length;

  return (
    <>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Cross-boundary transfers</div>
          <div className={styles.tileValue}>{crossBoundary.length}</div>
          <div className={styles.tileSub}>source and destination regions differ</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Carrying personal data</div>
          <div
            className={styles.tileValue}
            style={carryingPersonalData ? { color: WARN } : undefined}
          >
            {carryingPersonalData}
          </div>
          <div className={styles.tileSub}>classification is sensitive or higher</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Unsafeguarded personal-data transfers</div>
          <div className={styles.tileValue} style={unsafeguarded ? { color: DANGER } : undefined}>
            {unsafeguarded}
          </div>
          <div className={styles.tileSub}>no exception recorded</div>
        </div>
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Source region</Table.HeaderCell>
            <Table.HeaderCell>Destination region</Table.HeaderCell>
            <Table.HeaderCell>Classification</Table.HeaderCell>
            <Table.HeaderCell>Carries personal data</Table.HeaderCell>
            <Table.SortableHeaderCell
              sortKey="unsafeguarded"
              sort={sort}
              onSort={toggleSort}
              title="Exception/waiver pairing lands with #3301 — every personal-data cross-boundary transfer is flagged until then."
            >
              Safeguard status
            </Table.SortableHeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={5}>
              {relations.isLoading ? 'Loading flows…' : 'No cross-boundary transfers found.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(relation => {
              const coverage = coverageByUid.get(relation._uid);
              return (
                <Table.Row key={relation._uid}>
                  <Table.Cell>
                    {relationFieldValue(relationSchema, relation, 'source_residency_region')}
                  </Table.Cell>
                  <Table.Cell>
                    {relationFieldValue(relationSchema, relation, 'destination_residency_region')}
                  </Table.Cell>
                  <Table.Cell>
                    <Chip tone="ghost">
                      {relationFieldValue(relationSchema, relation, 'data_classification')}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>{coverage?.carriesPersonalData ? 'Yes' : 'No'}</Table.Cell>
                  <Table.Cell>
                    {coverage?.unsafeguardedPersonalDataTransfer ? (
                      <Chip tone="ghost" color={DANGER}>
                        No exception recorded
                      </Chip>
                    ) : coverage?.carriesPersonalData ? (
                      <span className="dim">—</span>
                    ) : (
                      <span className="dim">N/A</span>
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
